import { runAgent } from "../agent/agentLoop.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { formatAgentResponse } from "../utils/chatFormatter.js";
import { logger } from "../config/logger.js";
import { clearChatHistory } from "../services/chatHistory.service.js";
import { clearSession } from "../services/session.service.js";

/**
 * Handle POST /api/chat protected endpoint
 */
export async function handleChat(req, res) {
  const rawMessage = req.body.message;

  // 1. Validation: Reject undefined, null, or non-string inputs
  if (rawMessage === undefined || rawMessage === null) {
    return errorResponse(res, 400, "Message is required.");
  }

  if (typeof rawMessage !== "string") {
    return errorResponse(res, 400, "Message must be a string.");
  }

  // Trim whitespace
  const message = rawMessage.trim();

  // Reject empty or whitespace-only messages
  if (message === "") {
    return errorResponse(res, 400, "Message cannot be empty.");
  }

  // 2. Extract authenticated user ID string from JWT user payload
  const userId = req.user._id.toString();

  // 3. Call runAgent
  try {
    const result = await runAgent({
      userId,
      message
    });

    // 4. Format response to presentation-ready data
    const formattedResponse = formatAgentResponse(result);

    // 5. Return reply and cards wrapped in standardized successResponse
    return successResponse(
      res,
      formattedResponse,
      "Chat response generated successfully."
    );
  } catch (error) {
    logger.error(
      { err: error, userId, message },
      "Chat controller failed to process request"
    );

    return errorResponse(
      res,
      500,
      "Failed to process chat request."
    );
  }
}

/**
 * Handle DELETE /api/chat protected endpoint to clear chat history
 */
export async function clearChat(req, res) {
  const userId = req.user._id.toString();
  try {
    await clearChatHistory(userId);
    await clearSession(userId);
    return successResponse(res, null, "Chat history cleared successfully.");
  } catch (error) {
    logger.error(
      { err: error, userId },
      "Chat controller failed to clear history"
    );
    return errorResponse(res, 500, "Failed to clear chat history.");
  }
}
