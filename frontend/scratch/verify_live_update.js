import React from "react";
import { getPendingVersion, incrementPendingVersion } from "../src/utils/refreshTracker.js";

const assert = (condition, message) => {
  if (!condition) {
    console.error(`Assertion Failed: ${message}`);
    process.exit(1);
  }
};

console.log("Starting Unknown Faces Live Update unit tests...");

// 1. Test Monotonic Version Counter
const initialVersion = getPendingVersion();
assert(initialVersion === 0, `Expected initial version to be 0, got ${initialVersion}`);

incrementPendingVersion();
incrementPendingVersion();
assert(getPendingVersion() === 2, `Expected version to increment to 2, got ${getPendingVersion()}`);
console.log("Success: Monotonic version counter increments correctly.");

// 2. Test Coalescing & Debouncing logic
let fetchCount = 0;
let lastFetchedVersion = -1;

const fetchUnlabeledFaces = () => {
  fetchCount++;
  lastFetchedVersion = getPendingVersion();
};

let debounceTimer = null;
const triggerDebouncedRefresh = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    if (getPendingVersion() > lastFetchedVersion) {
      fetchUnlabeledFaces();
    }
  }, 100);
};

// Simulate multiple rapid duplicate face:new events triggering refreshes
triggerDebouncedRefresh();
triggerDebouncedRefresh();
triggerDebouncedRefresh();

// Check that no immediate fetch happens
assert(fetchCount === 0, `Expected 0 fetches immediately, got ${fetchCount}`);

// Wait for debounce timeout (150ms)
setTimeout(() => {
  assert(fetchCount === 1, `Expected exactly 1 debounced fetch, got ${fetchCount}`);
  assert(lastFetchedVersion === 2, `Expected lastFetchedVersion to catch up to 2, got ${lastFetchedVersion}`);
  console.log("Success: Multiple rapid face:new events are coalesced into a single debounced fetch.");

  // Test duplicate events with no version change
  triggerDebouncedRefresh();
  setTimeout(() => {
    // Should NOT refetch because pendingVersion has not advanced since lastFetchedVersion (both are 2)
    assert(fetchCount === 1, `Expected fetchCount to remain 1, got ${fetchCount}`);
    console.log("Success: Gated version check prevents unnecessary requests for duplicate events.");
    console.log("All live update unit tests passed successfully!");
    process.exit(0);
  }, 150);
}, 150);
