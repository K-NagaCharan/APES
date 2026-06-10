import { initializeWhatsApp } from "../src/services/whatsapp.service.js";
import { connectDB } from "../src/config/db.js";
import mongoose from "mongoose";
import { logger } from "../src/config/logger.js";
import fs from "fs";
import path from "path";

async function debugPage() {
  logger.info("Initializing DB...");
  await connectDB();

  logger.info("Initializing WhatsApp...");
  const client = initializeWhatsApp();

  logger.info("Waiting 15 seconds to let the page load...");
  await new Promise((resolve) => setTimeout(resolve, 15000));

  if (client.pupPage) {
    logger.info("Taking screenshot of Puppeteer page...");
    const screenshotPath = path.resolve("scratch/whatsapp_screenshot.png");
    
    // Ensure scratch folder exists
    if (!fs.existsSync(path.dirname(screenshotPath))) {
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    }

    try {
      await client.pupPage.screenshot({ path: screenshotPath });
      logger.info(`Screenshot saved to: ${screenshotPath}`);
      
      const title = await client.pupPage.title();
      logger.info(`Page title: ${title}`);
      
      const content = await client.pupPage.content();
      const bodySnippet = content.substring(0, 1000);
      logger.info(`Page content snippet: ${bodySnippet}`);
    } catch (err) {
      logger.error({ err: err.message }, "Failed to capture page details");
    }
  } else {
    logger.error("client.pupPage is not defined yet! Has client.initialize() been completed?");
  }

  logger.info("Closing database connection...");
  await mongoose.disconnect();
  
  // Note: We don't shut down WhatsApp so we can keep the background process running to inspect it.
  logger.info("Debug script done. Press Ctrl+C if it hangs.");
}

debugPage().catch((err) => {
  logger.error({ err }, "Debug script crashed");
  process.exit(1);
});
