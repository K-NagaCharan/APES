import mongoose from "mongoose";
import { clearSession } from "../src/services/session.service.js";
import redis from "../src/config/redis.js";

const userId = "6a268c108425277e3ddee488";

const run = async () => {
  console.log("Clearing Redis session key for user:", userId);
  await clearSession(userId);
  console.log("Session cleared successfully!");
  redis.disconnect();
};

run().catch(console.error);
