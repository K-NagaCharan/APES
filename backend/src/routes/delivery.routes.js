import express from "express";
import { getDeliveryHistoryHandler } from "../controllers/delivery.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/history", authMiddleware, asyncHandler(getDeliveryHistoryHandler));

export default router;
