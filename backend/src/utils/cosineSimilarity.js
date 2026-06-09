/**
 * Calculates the cosine similarity between two numerical vectors.
 * 
 * Formula:
 * similarity = (A . B) / (||A|| * ||B||)
 * 
 * @param {number[]} a - First numerical vector
 * @param {number[]} b - Second numerical vector
 * @returns {number} Cosine similarity score between -1.0 and 1.0
 * @throws {TypeError|Error} If arguments are invalid, of mismatched lengths, empty, or contain non-numbers
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new TypeError("Both arguments must be arrays");
  }
  if (a.length !== b.length) {
    throw new Error("Vectors must have equal length");
  }
  if (a.length === 0) {
    throw new Error("Vectors must be non-empty");
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];

    if (
      typeof valA !== "number" || 
      typeof valB !== "number" || 
      Number.isNaN(valA) || 
      Number.isNaN(valB)
    ) {
      throw new TypeError("Vectors must contain only valid numbers");
    }

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) {
    throw new Error("Vectors must have non-zero magnitude to calculate cosine similarity");
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  
  // Clamp value to [-1.0, 1.0] to protect against floating point precision drift
  return Math.max(-1.0, Math.min(1.0, similarity));
}
