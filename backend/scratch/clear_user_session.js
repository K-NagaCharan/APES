import redis from "../src/config/redis.js";

async function run() {
  const userId = "6a268c108425277e3ddee488";
  const key = `session:${userId}`;
  await redis.del(key);
  console.log("Successfully cleared Redis session for user:", userId);
  await redis.quit();
}

run().catch(console.error);
