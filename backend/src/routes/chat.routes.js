import express from "express";
import { handleChat } from "../controllers/chat.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.post("/", authMiddleware, asyncHandler(handleChat));

export default router;
