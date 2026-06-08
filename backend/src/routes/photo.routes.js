import { Router } from "express";
import { successResponse } from "../utils/apiResponse.js";

const router = Router();

// Placeholder route to be expanded in Sprint 1 Task 2
router.get("/", (req, res) => {
  return successResponse(res, null, "Photos listing placeholder (Sprint 1 Task 2)");
});

export default router;
