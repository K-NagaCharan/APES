import { updateMemory } from "../services/session.service.js";
import { logger } from "../config/logger.js";

/**
 * Update the agent's short-term conversational memory in Redis
 * based on the outcome of a successfully executed tool.
 *
 * @param {object} params
 * @param {string} params.userId - The ID of the authenticated user.
 * @param {string} params.toolName - The name of the tool that ran.
 * @param {object} [params.toolArgs] - The arguments passed to the tool.
 * @param {any} [params.toolResult] - The result returned by the tool executor.
 * @returns {Promise<void>}
 */
export async function updateAgentMemory({ userId, toolName, toolArgs, toolResult }) {
  if (!userId) {
    throw new Error("userId is required");
  }

  // Safe defaults
  const args = toolArgs ?? {};
  const result = toolResult ?? [];

  let partialMemory = null;

  switch (toolName) {
    case "searchPhotos": {
      const resultIds = Array.isArray(result)
        ? result.map((photo) => photo.id)
        : [];
      
      // Construct a human-readable query summary for rich metadata
      const queryParts = [];
      if (args.people && args.people.length > 0) queryParts.push(`people: [${args.people.join(", ")}]`);
      if (args.fromDate) queryParts.push(`from: ${args.fromDate}`);
      if (args.toDate) queryParts.push(`to: ${args.toDate}`);
      if (args.location) queryParts.push(`location: ${args.location}`);
      if (args.event) queryParts.push(`event: ${args.event}`);
      const queryStr = queryParts.join(", ") || "all photos";

      partialMemory = {
        lastPhotoSearch: {
          people: args.people ?? [],
          fromDate: args.fromDate ?? null,
          toDate: args.toDate ?? null,
          location: args.location ?? null,
          event: args.event ?? null,
          query: queryStr,
          photoIds: resultIds,
          resultIds,
          timestamp: new Date().toISOString()
        }
      };
      break;
    }

    case "sendEmail": {
      partialMemory = {
        lastDelivery: {
          method: "email",
          photoIds: args.photoIds ?? [],
          destination: args.email ?? null,
          timestamp: new Date().toISOString()
        }
      };
      break;
    }

    case "sendWhatsApp": {
      partialMemory = {
        lastDelivery: {
          method: "whatsapp",
          photoIds: args.photoIds ?? [],
          destination: args.phoneNumber ?? null,
          timestamp: new Date().toISOString()
        }
      };
      break;
    }

    case "requestZipConfirmation": {
      partialMemory = {
        pendingZipConfirmation: {
          deliveryMethod: args.deliveryMethod ?? null,
          estimatedSizeMB: args.estimatedSizeMB ?? null,
          pending: true
        }
      };
      break;
    }

    default: {
      logger.warn(`Memory update skipped for unknown tool "${toolName}"`);
      return;
    }
  }

  if (partialMemory) {
    await updateMemory(userId, partialMemory);
  }
}
