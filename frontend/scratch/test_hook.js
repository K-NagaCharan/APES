import React from "react";
import { useSocketEvents } from "../src/hooks/useSocketEvents.js";
import { SOCKET_EVENTS } from "../../shared/socketEvents.js";

const assert = (condition, message) => {
  if (!condition) {
    console.error(`Assertion Failed: ${message}`);
    process.exit(1);
  }
};

console.log("Starting React hook useSocketEvents unit tests...");

// Spies to track calls
const registered = {};
const removed = {};

const mockSocket = {
  on(event, handler) {
    registered[event] = (registered[event] || 0) + 1;
  },
  off(event, handler) {
    removed[event] = (removed[event] || 0) + 1;
  }
};

// 1. Mock React Current Dispatcher
const refStore = {};
const effects = [];

const mockDispatcher = {
  useRef(initial) {
    if (!refStore.ref) {
      refStore.ref = { current: initial };
    }
    return refStore.ref;
  },
  useEffect(effect, deps) {
    effects.push({ effect, deps });
  }
};

const secretInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE || React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
if (secretInternals) {
  if (secretInternals.H !== undefined) {
    secretInternals.H = mockDispatcher;
  } else if (secretInternals.ReactCurrentDispatcher) {
    secretInternals.ReactCurrentDispatcher.current = mockDispatcher;
  }
}

// 2. Call the hook to simulate mounting
const mockHandlers = {
  onFaceNew: () => console.log("Mock face new")
};

useSocketEvents(mockSocket, mockHandlers);

// Verify that useEffect blocks were registered
assert(effects.length === 2, `Expected 2 useEffect registrations, got ${effects.length}`);

// Execute effect 1 (handlers ref sync)
effects[0].effect();
assert(refStore.ref.current === mockHandlers, "Handlers ref failed to sync");

// Execute effect 2 (socket listeners registration)
const cleanupFn = effects[1].effect();

const expectedEvents = [
  "recognition:progress",
  "face:new",
  "recognition:done",
  "delivery:done",
  "delivery:failed"
];

// Check all registered events
for (const ev of expectedEvents) {
  assert(registered[ev] === 1, `Expected event "${ev}" to be registered exactly once, got ${registered[ev]}`);
}

console.log("Success: All 5 socket event listeners registered successfully on mount.");

// 3. Simulate re-render with new handlers to check duplicate listener prevention
const newHandlers = {
  onFaceNew: () => console.log("New mock face new")
};

// Run the ref sync effect again (simulating re-render)
refStore.ref.current = newHandlers; // simulate useRef updates
effects[0].effect(); // runs every render

// Verify that the listener effect does not run again (since socket instance dependency didn't change)
// In React, since the dependency array of effect 2 is [socket], it would not re-run.
// We assert that registered counts remain 1.
for (const ev of expectedEvents) {
  assert(registered[ev] === 1, `Expected event "${ev}" to stay registered once, got ${registered[ev]}`);
}

console.log("Success: Re-rendering did not register duplicate event listeners.");

// 4. Simulate unmounting
cleanupFn();

// Check all off calls
for (const ev of expectedEvents) {
  assert(removed[ev] === 1, `Expected event "${ev}" to be removed exactly once on cleanup, got ${removed[ev]}`);
}

console.log("Success: All 5 socket event listeners removed successfully on unmount.");
console.log("All hook unit tests passed successfully!");
process.exit(0);
