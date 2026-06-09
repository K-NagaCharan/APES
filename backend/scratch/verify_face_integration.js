import http from "http";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { checkFaceServiceHealth, recognizeFaces, client } from "../src/services/faceRecognition.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to sleep/delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("=== STARTING NODE TO PYTHON INTEGRATION TESTS ===");

  // 1. Start the Flask microservice locally on port 5001
  console.log("\nStarting Python Flask microservice process...");
  const pythonBin = os.platform() === "win32" 
    ? path.join(__dirname, "..", "..", "face-service", "venv", "Scripts", "python.exe")
    : path.join(__dirname, "..", "..", "face-service", "venv", "bin", "python");

  const appPyPath = path.join(__dirname, "..", "..", "face-service", "app.py");

  const flaskEnv = { ...process.env, PORT: "5001" };
  const flaskProcess = spawn(pythonBin, [appPyPath], { env: flaskEnv });

  // Wait for the Flask service to boot and report healthy
  let isHealthy = false;
  console.log("Waiting for Flask service to start up on port 5001...");
  for (let i = 0; i < 15; i++) {
    const health = await checkFaceServiceHealth();
    if (health.healthy) {
      console.log(`Flask service is healthy! Model: ${health.model}, Detector: ${health.detector}`);
      isHealthy = true;
      break;
    }
    await sleep(1000);
  }

  if (!isHealthy) {
    console.error("Failed to start Flask microservice. Terminating...");
    flaskProcess.kill("SIGKILL");
    process.exit(1);
  }

  try {
    // --- TEST 1: Healthy health check returns status info ---
    console.log("\n[TEST 1] Testing healthy checkFaceServiceHealth()...");
    const healthCheck = await checkFaceServiceHealth();
    console.log("Result:", healthCheck);
    if (!healthCheck.healthy || healthCheck.service !== "face-service") {
      throw new Error("TEST 1 FAILED: Expected healthy status");
    }
    console.log("[TEST 1] PASSED.");

    // --- TEST 3: Recognize faces on a valid image ---
    console.log("\n[TEST 3] Testing recognizeFaces() with a valid image URL...");
    const validUrl = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80";
    const recognition = await recognizeFaces(validUrl);
    console.log("Recognition Response status:", !!recognition);
    console.log("Faces array length:", recognition.faces ? recognition.faces.length : 0);
    if (!recognition || !recognition.faces || recognition.faces.length !== 1) {
      throw new Error("TEST 3 FAILED: Expected exactly 1 face in the Unsplash portrait");
    }
    console.log("[TEST 3] PASSED.");

    // --- TEST 4: Invalid image URL (no retry on HTTP 400) ---
    console.log("\n[TEST 4] Testing recognizeFaces() with invalid image URL (no retry on HTTP 400)...");
    const startTime4 = Date.now();
    let caughtError4 = false;
    try {
      await recognizeFaces(" ");
    } catch (err) {
      caughtError4 = true;
      const duration4 = Date.now() - startTime4;
      console.log(`Caught expected error: "${err.message}" in ${duration4}ms`);
      if (err.message !== "Face service unavailable") {
        throw new Error(`TEST 4 FAILED: Unexpected error message: ${err.message}`);
      }
      if (duration4 > 2000) {
        throw new Error(`TEST 4 FAILED: Response took ${duration4}ms. It likely retried when it should have failed immediately.`);
      }
    }
    if (!caughtError4) {
      throw new Error("TEST 4 FAILED: Expected call to throw an error");
    }
    console.log("[TEST 4] PASSED.");

    // --- Terminate Flask microservice to test stopped/fallback behavior ---
    console.log("\nTerminating Flask microservice process...");
    flaskProcess.kill("SIGTERM");
    await sleep(2000); // Wait for port 5001 to free up

    // --- TEST 2: Stopped health check returns graceful false ---
    console.log("\n[TEST 2] Testing checkFaceServiceHealth() with stopped service...");
    const healthCheckStopped = await checkFaceServiceHealth();
    console.log("Result:", healthCheckStopped);
    if (healthCheckStopped.healthy) {
      throw new Error("TEST 2 FAILED: Expected healthy to be false");
    }
    if (healthCheckStopped.service !== "face-service") {
      throw new Error("TEST 2 FAILED: Expected service value to be 'face-service'");
    }
    console.log("[TEST 2] PASSED.");

    // --- Set up mock HTTP server on port 5001 to test transient retries ---
    console.log("\nStarting mock HTTP server on port 5001...");
    let mockResponseCode = 503;
    let mockDelayMs = 0;
    let requestCount = 0;

    const mockServer = http.createServer((req, res) => {
      requestCount++;
      if (mockDelayMs > 0) {
        setTimeout(() => {
          res.writeHead(mockResponseCode, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", message: "Mock Server Error" }));
        }, mockDelayMs);
      } else {
        res.writeHead(mockResponseCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", message: "Mock Server Error" }));
      }
    });

    mockServer.listen(5001);
    await sleep(500);

    // --- TEST 5: Transient failures (HTTP 503 retries with backoff) ---
    console.log("\n[TEST 5] Testing transient HTTP 503 error retrying policy...");
    mockResponseCode = 503;
    mockDelayMs = 0;
    requestCount = 0;
    const startTime5 = Date.now();
    let caughtError5 = false;

    try {
      await recognizeFaces("http://example.com/image.jpg");
    } catch (err) {
      caughtError5 = true;
      const duration5 = Date.now() - startTime5;
      console.log(`Caught error: "${err.message}" after ${duration5}ms`);
      console.log(`Mock server received request count: ${requestCount}`);
      
      if (err.message !== "Face service unavailable") {
        throw new Error(`TEST 5 FAILED: Unexpected error message: ${err.message}`);
      }
      if (requestCount !== 3) {
        throw new Error(`TEST 5 FAILED: Expected exactly 3 attempts, got ${requestCount}`);
      }
      // Delay intervals are 500ms and 1000ms. Expect duration to be at least 1500ms.
      if (duration5 < 1500) {
        throw new Error(`TEST 5 FAILED: Backoff delays not respected, completed in ${duration5}ms`);
      }
    }
    if (!caughtError5) {
      throw new Error("TEST 5 FAILED: Expected transient error to throw");
    }
    console.log("[TEST 5] PASSED.");

    // --- TEST 6: Non-transient failure (HTTP 500 fails immediately) ---
    console.log("\n[TEST 6] Testing non-transient HTTP 500 error policy (no retry)...");
    mockResponseCode = 500;
    mockDelayMs = 0;
    requestCount = 0;
    const startTime6 = Date.now();
    let caughtError6 = false;

    try {
      await recognizeFaces("http://example.com/image.jpg");
    } catch (err) {
      caughtError6 = true;
      const duration6 = Date.now() - startTime6;
      console.log(`Caught error: "${err.message}" after ${duration6}ms`);
      console.log(`Mock server received request count: ${requestCount}`);
      
      if (err.message !== "Face service unavailable") {
        throw new Error(`TEST 6 FAILED: Unexpected error message: ${err.message}`);
      }
      if (requestCount !== 1) {
        throw new Error(`TEST 6 FAILED: Expected exactly 1 attempt, got ${requestCount}`);
      }
      if (duration6 > 500) {
        throw new Error(`TEST 6 FAILED: Took too long (${duration6}ms). It likely retried.`);
      }
    }
    if (!caughtError6) {
      throw new Error("TEST 6 FAILED: Expected HTTP 500 to throw");
    }
    console.log("[TEST 6] PASSED.");

    // --- TEST 7: Timeout failure (Axios overrides timeout to 200ms) ---
    console.log("\n[TEST 7] Testing timeout retrying policy...");
    client.defaults.timeout = 200; // Force short 200ms timeout
    mockResponseCode = 200;
    mockDelayMs = 500; // Mock server delays writing output longer than timeout
    requestCount = 0;
    const startTime7 = Date.now();
    let caughtError7 = false;

    try {
      await recognizeFaces("http://example.com/image.jpg");
    } catch (err) {
      caughtError7 = true;
      const duration7 = Date.now() - startTime7;
      console.log(`Caught error: "${err.message}" after ${duration7}ms`);
      console.log(`Mock server received request count: ${requestCount}`);

      if (err.message !== "Face service unavailable") {
        throw new Error(`TEST 7 FAILED: Unexpected error message: ${err.message}`);
      }
      if (requestCount !== 3) {
        throw new Error(`TEST 7 FAILED: Expected exactly 3 attempts, got ${requestCount}`);
      }
      // (200ms timeout + 500ms delay) + (200ms timeout + 1000ms delay) + 200ms timeout = 2100ms
      if (duration7 < 2000) {
        throw new Error(`TEST 7 FAILED: Backoff delays not respected, completed in ${duration7}ms`);
      }
    }
    if (!caughtError7) {
      throw new Error("TEST 7 FAILED: Expected timeout to throw");
    }
    console.log("[TEST 7] PASSED.");

    // Close mock HTTP server
    console.log("\nClosing mock HTTP server...");
    mockServer.close();
    
    console.log("\n=== ALL BACKEND INTEGRATION TESTS PASSED SUCCESSFULY ===");

  } catch (error) {
    console.error("\nTEST SUITE CRITICAL FAILURE:", error.message);
    // Cleanup processes on failure
    flaskProcess.kill("SIGKILL");
    process.exit(1);
  } finally {
    // Ensure cleanup is always called
    flaskProcess.kill("SIGKILL");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
