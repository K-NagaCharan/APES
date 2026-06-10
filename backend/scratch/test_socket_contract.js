import { SOCKET_EVENTS } from "../../shared/socketEvents.js";

console.log("Loaded SOCKET_EVENTS successfully:");
console.log(SOCKET_EVENTS);

// Verify expected properties
const expectedEvents = [
  "recognition:progress",
  "face:new",
  "recognition:done",
  "delivery:done",
  "delivery:failed",
  "delivery:zip-confirm"
];

const actualValues = Object.values(SOCKET_EVENTS);

let missing = 0;
for (const val of expectedEvents) {
  if (!actualValues.includes(val)) {
    console.error(`Error: Missing event value "${val}"`);
    missing++;
  }
}

if (missing === 0) {
  console.log("Success: All expected socket events are present and correct!");
} else {
  process.exit(1);
}
