import redis from "../src/config/redis.js";

async function run() {
  const userId = "6a268c108425277e3ddee488";
  const data = await redis.get(`session:${userId}`);
  if (!data) {
    console.log("No session found for user:", userId);
  } else {
    const session = JSON.parse(data);
    console.log("Session Messages Count:", session.messages.length);
    console.log("Session Memory:", JSON.stringify(session.memory, null, 2));
    
    // Calculate total character length and approximate tokens
    const totalCharLength = JSON.stringify(session.messages).length;
    console.log("Total messages char length:", totalCharLength);
    console.log("Approximate tokens:", Math.round(totalCharLength / 4));
    
    // Print each message size and preview
    session.messages.forEach((msg, idx) => {
      const charLen = JSON.stringify(msg).length;
      console.log(`[Message ${idx}] Role: ${msg.role}, Name: ${msg.name || "N/A"}, Size: ${charLen} chars (~${Math.round(charLen/4)} tokens)`);
      if (msg.content && msg.content.length > 200) {
        console.log(`  Preview: ${msg.content.slice(0, 200)}...`);
      } else {
        console.log(`  Content:`, msg.content);
      }
    });
  }
  await redis.quit();
}

run().catch(console.error);
