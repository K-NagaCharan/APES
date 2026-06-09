import api from "./api.js";

/**
 * Send a user message to the backend Agent loop.
 *
 * @param {string} message - The message prompt to send.
 * @returns {Promise<object>} { reply: string }
 */
export const sendMessage = async (message) => {
  const response = await api.post("/chat", { message });
  return response.data.data;
};

/**
 * Request to clear the user's chat history from database.
 *
 * @returns {Promise<object>}
 */
export const clearHistory = async () => {
  const response = await api.delete("/chat");
  return response.data;
};
