import { env } from "./env.js";

export const MODELS = {
  FAST: env.GROQ_FAST_MODEL || "llama-3.1-8b-instant",
  REASONING: env.GROQ_REASONING_MODEL || "llama-3.3-70b-versatile"
};

