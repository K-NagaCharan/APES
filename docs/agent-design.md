# Agent Loop and Tool Calling Design

This document details the Groq agent configuration, tool definitions, session state structures, state injection strategies, and robust failure handling.

---

## 1. Groq Tool Definitions

The Groq agent is provided with five functional tools. These schemas are parsed by Groq to validate parameters before dispatching tool calls to the Express application.

### Tool: `searchPhotos`
Finds photos for specific people, dates, location, or event name.
```json
{
  "name": "searchPhotos",
  "description": "Search the user's photo collection using structured filters.",
  "parameters": {
    "type": "object",
    "properties": {
      "people": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Names of labeled people to filter photos by."
      },
      "fromDate": {
        "type": "string",
        "description": "Start date for filtering photos in ISO format (YYYY-MM-DD)."
      },
      "toDate": {
        "type": "string",
        "description": "End date for filtering photos in ISO format (YYYY-MM-DD)."
      },
      "location": {
        "type": "string",
        "description": "Location name where photos were taken."
      },
      "event": {
        "type": "string",
        "description": "Event description or name associated with photos."
      }
    },
    "additionalProperties": false
  }
}
```

### Tool: `getPeople`
Retrieves all known labeled persons in the user's database.
```json
{
  "name": "getPeople",
  "description": "Return the list of labeled people belonging to the authenticated user.",
  "parameters": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

### Tool: `sendEmail`
Sends a set of photos to a specific recipient via email.
```json
{
  "name": "sendEmail",
  "description": "Send photos via email.",
  "parameters": {
    "type": "object",
    "properties": {
      "photoIds": {
        "type": "array",
        "items": { "type": "string" },
        "minItems": 1,
        "description": "Array of MongoDB photo IDs to email."
      },
      "email": {
        "type": "string",
        "format": "email",
        "description": "The recipient's email address."
      }
    },
    "required": ["photoIds", "email"],
    "additionalProperties": false
  }
}
```

### Tool: `sendWhatsApp`
Sends a WhatsApp message containing links to the requested photos.
```json
{
  "name": "sendWhatsApp",
  "description": "Send photos through WhatsApp.",
  "parameters": {
    "type": "object",
    "properties": {
      "photoIds": {
        "type": "array",
        "items": { "type": "string" },
        "minItems": 1,
        "description": "Array of MongoDB photo IDs to send."
      },
      "phoneNumber": {
        "type": "string",
        "description": "The recipient's WhatsApp phone number in international format."
      }
    },
    "required": ["photoIds", "phoneNumber"],
    "additionalProperties": false
  }
}
```

### Tool: `requestZipConfirmation`
Requests user approval to send a compressed ZIP when the delivery size exceeds platform limits.
```json
{
  "name": "requestZipConfirmation",
  "description": "Ask the frontend whether the user approves ZIP compression when delivery exceeds platform limits.",
  "parameters": {
    "type": "object",
    "properties": {
      "deliveryMethod": {
        "type": "string",
        "enum": ["email", "whatsapp"],
        "description": "The delivery method chosen by the user."
      },
      "estimatedSizeMB": {
        "type": "number",
        "description": "The estimated total size in megabytes of the photos to be sent."
      }
    },
    "required": ["deliveryMethod", "estimatedSizeMB"],
    "additionalProperties": false
  }
}
```

---

## 2. Session Memory Layout

Conversation and operational states are cached per user in Redis with a 24-hour TTL.

```json
{
  "messages": [
    { "role": "user", "content": "Show me Dad's photos from last week" },
    { "role": "assistant", "tool_calls": [ { "id": "call_1", "type": "function", "function": { "name": "searchPhotos", "arguments": "{\"people\":[\"Dad\"]}" } } ] },
    { "role": "tool", "tool_call_id": "call_1", "content": "[{\"id\":\"60c72...\",\"url\":\"...\"}]" },
    { "role": "assistant", "content": "I found 2 photos of Dad." }
  ],
  "memory": {
    "lastPhotoSearch": {
      "people": ["Dad"],
      "fromDate": null,
      "toDate": null,
      "location": null,
      "event": null,
      "resultIds": ["60c72b2f9b1d8b2bad689a22", "60c72b2f9b1d8b2bad689a23"]
    },
    "lastDelivery": {
      "method": "email",
      "photoIds": ["60c72b2f9b1d8b2bad689a22", "60c72b2f9b1d8b2bad689a23"],
      "destination": "mom@example.com",
      "timestamp": "2026-06-10T06:50:00.000Z"
    },
    "pendingZipConfirmation": {
      "deliveryMethod": "email",
      "estimatedSizeMB": 32.5,
      "pending": true
    }
  }
}
```

---

## 3. Agent Loop Logic (Pseudocode)

```javascript
async function runAgent({ userId, message }) {
  // 1. Load session from Redis (default defaultSession initialized if missing)
  const session = await getSession(userId);

  // 2. Append the user message to memory
  session.messages.push({ role: "user", content: message });

  // 3. Select model using deterministic heuristic (8b for simple query, 70b for actions)
  const model = selectModel(message);

  let depth = 0;
  const executedToolCalls = [];
  let finalReply = "";

  const systemPrompt = {
    role: "system",
    content: "CRITICAL RULES:\n1. Only call tools when the user's request explicitly requires it...\nToday's date is YYYY-MM-DD"
  };

  // 4. Orchestration loop
  while (depth < MAX_TOOL_DEPTH) {
    depth++;
    const groqMessages = [systemPrompt, ...session.messages];

    const response = await groq.chat.completions.create({
      model,
      messages: groqMessages,
      tools: TOOLS,
      tool_choice: "auto"
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      session.messages.push({
        role: "assistant",
        content: responseMessage.content || null,
        tool_calls: responseMessage.tool_calls
      });

      for (const toolCall of responseMessage.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        // Execute tool handler and update agent short-term memory key in Redis
        const result = await executeTool(name, args, userId);
        await updateAgentMemory({ userId, toolName: name, toolArgs: args, toolResult: result });

        session.messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result)
        });
      }
    } else {
      finalReply = responseMessage.content || "";
      session.messages.push({ role: "assistant", content: finalReply });
      break;
    }
  }

  // 5. Trim history and save updated session back to Redis
  const latestSession = await getSession(userId);
  latestSession.messages = session.messages;
  if (latestSession.messages.length > MAX_MESSAGES) {
    latestSession.messages = latestSession.messages.slice(-MAX_MESSAGES);
  }
  await saveSession(userId, latestSession);

  // 6. Save chat log to database
  await saveChatHistory({ userId, userMessage: message, assistantReply: finalReply });

  return { reply: finalReply, model, toolCalls: executedToolCalls };
}
```

---

## 4. Failure Handling Strategies

### A. Tool Parameter Validation
- **Type Coercion:** If the model sends a string instead of an array, the tool execution layer automatically coerces it to an array before querying.
- **Email/Phone Format Checks:** The email tool parses the recipient address with a standard regex; the WhatsApp tool strips any symbol formatting (e.g. `+` or `-`).
- **Validation Failures:** If validation fails, the tool does not throw an API exception. It returns a descriptive string back to the LLM (e.g., `{"error": "Invalid email address format. Ask the user for clarification."}`).

### B. Tool Execution Failures
- **Graceful Catch-Alls:** All tool call executions are wrapped in individual `try/catch` statements.
- **Masking Stack Traces:** If a tool query or external call throws an error, the backend catches the error, logs the trace locally, and passes a descriptive error to the LLM. This prevents exposure of sensitive connection traces.
- **LLM Context Recovery:** Since the tool results contain error messages, the LLM is given the context to explain the issue to the user and request actions gracefully.

### C. Agent Loop Safety Limits
- **Runaway Prevention:** The loop is strictly limited to `MAX_TOOL_DEPTH` (default `5`) steps. If it hits this ceiling, the system breaks out, returns the client the best available output, and logs an alarm.
- **History Pruning:** The memory size is capped at `MAX_MESSAGES` (default `30`) messages. Pruning slices off the oldest messages while keeping system context intact.
- **Python Microservice Failures:** The node server checks the Python service's health via `/health` on API start. If it's down, background uploads refuse to queue job workers, updating photo statuses to `failed: service_unavailable` and warning the user.

### D. Session Corruption Recovery
- **Safe Session Deserialization:** Reading from Redis uses `try/catch`. If `JSON.parse()` fails (corrupt session), a warning is logged, the existing key is cleared, and a clean session dictionary is initialized. The user's application does not crash.
