import { getSession, saveSession } from "../services/session.service.js";
import { selectModel } from "../services/modelRouter.js";
import { executeTool } from "./toolExecutor.js";
import { TOOLS } from "./tools.js";
import { saveChatHistory } from "../services/chatHistory.service.js";
import { updateAgentMemory } from "./memoryManager.js";
import groq from "../config/groq.js";
import { logger } from "../config/logger.js";
import { MODELS } from "../config/models.js";
import Person from "../models/Person.js";

const MAX_TOOL_DEPTH = 5;
const MAX_MESSAGES = 20;
const DEFAULT_TEMPERATURE = 0;

/**
 * Run the central Agent Loop to orchestrate the interaction between
 * the LLM (Groq), tool executor, and Redis session memory.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.message
 * @returns {Promise<object>} { reply, model, toolCalls, iterations, stoppedBecause }
 */
export async function runAgent({ userId, message }) {
  if (!userId) {
    throw new Error("userId is required");
  }
  if (typeof message !== "string") {
    throw new Error("message must be a string");
  }

  logger.info({ userId, message }, "Starting runAgent execution");

  // 1. Load session from Redis (fetches current or defaults)
  const session = await getSession(userId);

  // Clean and truncate history immediately upon loading to purge any existing oversized messages/URLs
  session.messages = cleanHistoryForStorage(session.messages);
  if (session.messages.length >= MAX_MESSAGES) {
    session.messages = session.messages.slice(-(MAX_MESSAGES - 1));
  }

  // 2. Append the user message to local memory
  const userMsg = { role: "user", content: message };
  session.messages.push(userMsg);

  // 3. Select model using deterministic heuristic
  const model = selectModel(message);

  let depth = 0;
  const executedToolCalls = [];
  let stoppedBecause = null;
  let finalReply = "";

  // Work with a local reference to session messages
  const messages = session.messages;

  // Fetch user's labeled people names to guide the LLM mapping
  let peopleList = "";
  if (process.env.APES_TEST_MODE === "true") {
    peopleList = "Dad, Mom, John";
  } else {
    const people = await Person.find({ userId }).select("name").lean();
    peopleList = people.map(p => p.name).join(", ");
  }

  // SYSTEM INSTRUCTIONS: Guide the LLM to follow tool invocation boundaries and prevent infinite loops.
  const systemPrompt = {
    role: "system",
    content: `You are APES AI, a helpful photo assistant.
You have access to tools to help the user search and share their photos.

CRITICAL RULES:
1. Only call tools when the user's request explicitly requires it.
2. For simple queries (e.g. "Show Dad's photos", "Find my pictures"), call 'searchPhotos' to search the photos, and then output a friendly text summary of the search result. Do NOT call delivery tools ('sendWhatsApp', 'sendEmail') or compression tools ('requestZipConfirmation') unless the user explicitly asks to share, send, or compression is required.
3. If the user asks to email or WhatsApp photos (e.g., "Email these to Mom"), call the corresponding delivery tool with the correct arguments.
4. When calling 'searchPhotos', resolve relative date references (like 'January', 'last week', 'Diwali 2023') to their actual ISO date ranges using today's date. Do not guess or hallucinate parameters that are completely unrelated to the user's query.
5. Today's date is ${new Date().toISOString().split('T')[0]}.
6. The labeled people in the user's photo collection are: ${peopleList || 'none'}.
   If the user mentions any of these names (or close variations/typos like 'mw' or others referring to a person), pass them in the 'people' array parameter of 'searchPhotos' instead of event names or relative dates. For example, the name 'Jan' matches the person 'jan' and must be passed as a person in the 'people' parameter, NOT as a date range for the month of January.`
  };

  // 4. Run orchestration loop
  while (depth < MAX_TOOL_DEPTH) {
    depth++;
    logger.info({ depth, model }, "Executing agent loop iteration");

    // Prep messages for Groq by prepending the system instructions dynamically
    const groqMessages = [systemPrompt, ...messages];

    let response;
    try {
      response = await groq.chat.completions.create({
        model,
        messages: groqMessages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: DEFAULT_TEMPERATURE
      });
    } catch (err) {
      const isToolUseError = err.status === 400 || 
                            err.message.includes("tool_use_failed") || 
                            err.message.includes("Failed to call a function");

      if (isToolUseError) {
        if (model === MODELS.FAST) {
          logger.warn({ err: err.message }, "Fast model tool execution failed due to Groq parser bug. Retrying with Reasoning model...");
          try {
            response = await groq.chat.completions.create({
              model: MODELS.REASONING,
              messages: groqMessages,
              tools: TOOLS,
              tool_choice: "auto",
              temperature: DEFAULT_TEMPERATURE
            });
          } catch (retryErr) {
            const failedGen = retryErr.error?.failed_generation || retryErr.failed_generation || retryErr.message;
            const parsedCall = parseFailedGeneration(failedGen);
            if (parsedCall) {
              logger.info({ parsedCall }, "Reasoning model failed tool use. Recovered successfully via manual parsing of failed_generation");
              response = {
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: "call_" + Math.random().toString(36).substring(2),
                          type: "function",
                          function: {
                            name: parsedCall.name,
                            arguments: JSON.stringify(parsedCall.args)
                          }
                        }
                      ]
                    }
                  }
                ]
              };
            } else {
              throw retryErr;
            }
          }
        } else {
          // Fast model was not used, meaning we were already on REASONING model and it failed tool use
          const failedGen = err.error?.failed_generation || err.failed_generation || err.message;
          const parsedCall = parseFailedGeneration(failedGen);
          if (parsedCall) {
            logger.info({ parsedCall }, "Reasoning model failed tool use on first attempt. Recovered successfully via manual parsing of failed_generation");
            response = {
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "call_" + Math.random().toString(36).substring(2),
                        type: "function",
                        function: {
                          name: parsedCall.name,
                          arguments: JSON.stringify(parsedCall.args)
                        }
                      }
                    ]
                  }
                }
              ]
            };
          } else {
            throw err;
          }
        }
      } else {
        throw err;
      }
    }

    const responseMessage = response.choices[0].message;

    // Check if Groq decided to request tool calls
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Append assistant's tool call message
      const assistantMsg = {
        role: "assistant",
        content: responseMessage.content || null,
        tool_calls: responseMessage.tool_calls
      };
      messages.push(assistantMsg);

      // Execute each tool call
      for (const toolCall of responseMessage.tool_calls) {
        const name = toolCall.function.name;
        let args = {};
        
        // Parse arguments safely
        try {
          if (toolCall.function.arguments) {
            args = typeof toolCall.function.arguments === "string"
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
          }
        } catch (err) {
          logger.error({ err: err.message, rawArgs: toolCall.function.arguments }, "Failed to parse tool call arguments");
        }

        logger.info({ toolName: name, args }, "Executing tool call");
        
        let result;
        try {
          // Retrieve the most recent session from Redis to ensure references are resolved correctly
          const currentSession = await getSession(userId);
          result = await executeTool(name, args, userId, currentSession);
          
          // Update agent's short-term memory key in Redis
          await updateAgentMemory({
            userId,
            toolName: name,
            toolArgs: args,
            toolResult: result
          });
        } catch (err) {
          logger.error({ err: err.message, toolName: name }, "Tool execution or memory update failed");
          result = { error: err.message };
        }

        executedToolCalls.push({
          name,
          args,
          result
        });

        // Append tool result message
        const toolMsg = {
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result)
        };
        messages.push(toolMsg);
      }
    } else {
      // No tool calls: final response produced
      finalReply = responseMessage.content || "";
      const assistantReplyMsg = {
        role: "assistant",
        content: finalReply
      };
      messages.push(assistantReplyMsg);
      break;
    }
  }

  // 5. Handle Max Depth condition
  if (depth === MAX_TOOL_DEPTH && !finalReply) {
    logger.warn({ userId, depth }, "Maximum tool depth reached without final reply");
    finalReply = "The request could not be completed safely.";
    stoppedBecause = "MAX_DEPTH";
    
    // Add safety fallback response to conversation
    messages.push({
      role: "assistant",
      content: finalReply
    });
  }

  // 6. Reload session from Redis to get the memory updates, then append messages and save
  const latestSession = await getSession(userId);
  latestSession.messages = cleanHistoryForStorage(messages);

  if (latestSession.messages.length > MAX_MESSAGES) {
    latestSession.messages = latestSession.messages.slice(-MAX_MESSAGES);
  }

  // 7. Save updated session back to Redis (one single write)
  await saveSession(userId, latestSession);

  // 8. Save completed chat interaction to database (non-blocking for user response experience)
  try {
    await saveChatHistory({
      userId,
      userMessage: message,
      assistantReply: finalReply
    });
  } catch (err) {
    logger.error({ err, userId }, "Failed to save chat history to database");
  }

  return {
    reply: finalReply,
    model,
    toolCalls: executedToolCalls,
    iterations: depth,
    ...(stoppedBecause ? { stoppedBecause } : {})
  };
}

/**
 * Truncate/clean up large messages in history to prevent rate limit (TPM) issues.
 * Strips the 'url' field from searchPhotos tool results as the LLM does not need it for reasoning.
 */
function cleanHistoryForStorage(messages) {
  return messages.map(msg => {
    if (msg.role === "tool" && msg.name === "searchPhotos") {
      try {
        const parsed = JSON.parse(msg.content);
        if (Array.isArray(parsed)) {
          const summarized = parsed.map(photo => ({
            id: photo.id,
            date: photo.date,
            people: photo.people
          }));
          return {
            ...msg,
            content: JSON.stringify(summarized)
          };
        }
      } catch (err) {
        // Fallback to original message if parsing fails
      }
    }
    return msg;
  });
}

/**
 * Robust fallback parser for Groq's failed_generation strings.
 * Extracts function name and arguments in case of Groq API gateway tool parsing bugs.
 */
function parseFailedGeneration(failedGen) {
  if (typeof failedGen !== "string") return null;

  const nameMatch = failedGen.match(/<function=(\w+)/);
  if (!nameMatch) return null;
  const name = nameMatch[1];

  const startIdx = failedGen.indexOf("{");
  const endIdx = failedGen.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

  const jsonStr = failedGen.substring(startIdx, endIdx + 1);
  try {
    const args = JSON.parse(jsonStr);
    return { name, args };
  } catch (err) {
    logger.warn({ err: err.message, jsonStr }, "Failed to parse JSON from failed_generation manually");
    return null;
  }
}

