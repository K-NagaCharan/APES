import express from "express";
import { handleChat, clearChat } from "../controllers/chat.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.post("/", authMiddleware, asyncHandler(handleChat));
router.delete("/", authMiddleware, asyncHandler(clearChat));

export default router;
