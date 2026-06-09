import { MODELS } from "../config/models.js";

const REASONING_KEYWORDS = [
  "send",
  "email",
  "mail",
  "whatsapp",
  "share",
  "deliver",
  "zip",
  "compress",
  "archive",
  "then",
];

/**
 * Select the appropriate model based on the message content.
 *
 * The router is fault-tolerant and deterministic. If the message is not a string
 * or is empty, it defaults to MODELS.FAST. Otherwise, it checks if the normalized
 * message contains any reasoning-related keywords.
 *
 * @param {string} message - The user input message.
 * @returns {string} The model identifier to use (FAST or REASONING).
 */
export function selectModel(message) {
  if (typeof message !== "string") {
    return MODELS.FAST;
  }

  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return MODELS.FAST;
  }

  const needsReasoning = REASONING_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );

  return needsReasoning ? MODELS.REASONING : MODELS.FAST;
}
