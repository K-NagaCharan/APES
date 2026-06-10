import { Router } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { successResponse } from "../utils/apiResponse.js";
import { getWhatsAppStatus } from "../services/whatsapp.service.js";

const router = Router();

router.get("/", async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const whatsappStatus = await getWhatsAppStatus();
  const data = {
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    whatsapp: whatsappStatus,
    environment: env.NODE_ENV
  };

  return successResponse(res, data, "Health check status retrieved successfully");
});

export default router;
