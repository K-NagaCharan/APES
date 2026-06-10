function parseFailedGeneration(failedGen) {
  if (typeof failedGen !== "string") return null;
  
  const nameMatch = failedGen.match(/<function=(\w+)/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  
  const startIdx = failedGen.indexOf("{");
  const endIdx = failedGen.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  
  const jsonStr = failedGen.substring(startIdx, endIdx + 1);
  try {
    const args = JSON.parse(jsonStr);
    return { name, args };
  } catch (err) {
    console.warn("Failed to parse JSON from failed_generation:", err.message, jsonStr);
    return null;
  }
}

const failedGen1 = "<function=searchPhotos>{\"event\": \"jan\", \"toDate\": \"2026-06-10\", \"fromDate\": \"2026-01-01\"}<function>";
const failedGen2 = "<function=searchPhotos {\"fromDate\": \"2026-01-01\", \"toDate\": \"2026-01-31\"}</function>";

console.log("Result 1:", parseFailedGeneration(failedGen1));
console.log("Result 2:", parseFailedGeneration(failedGen2));
