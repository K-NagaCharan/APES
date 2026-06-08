import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () => {
      logger.info("MongoDB database connection established successfully.");
    });

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB database connection lost/disconnected.");
    });

    await mongoose.connect(env.MONGO_URI);
  } catch (error) {
    logger.error(`Failed to connect to MongoDB on startup: ${error.message}`);
    process.exit(1);
  }
};
