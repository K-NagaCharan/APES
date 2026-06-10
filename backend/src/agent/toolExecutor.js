import { execute as searchPhotos } from "./tools/searchPhotos.js";
import { execute as getPeople } from "./tools/getPeople.js";
import { execute as sendEmail } from "./tools/sendEmail.js";
import { execute as sendWhatsApp } from "./tools/sendWhatsApp.js";
import { execute as requestZipConfirmation } from "./tools/requestZipConfirmation.js";
import { resolvePhotoReferences } from "./referenceResolver.js";

/**
 * Dispatch an AI tool call to the appropriate tool implementation.
 *
 * @param {string} toolName - The name of the tool to execute.
 * @param {Object} [args] - The arguments passed to the tool.
 * @param {string} userId - The user ID of the authenticated user.
 * @param {Object} [session] - The current user session for reference resolution.
 * @returns {Promise<any>} The result of the tool execution.
 * @throws {Error} If the toolName is not recognized.
 */
export async function executeTool(toolName, args, userId, session) {
  // Safe argument handling
  const safeArgs = args ?? {};

  switch (toolName) {
    case "searchPhotos":
      return searchPhotos(safeArgs, userId);

    case "getPeople":
      return getPeople(safeArgs, userId);

    case "sendEmail": {
      const resolution = resolvePhotoReferences(session, safeArgs.photoIds);
      if (!resolution.success) {
        return { success: false, error: resolution.error };
      }
      const resolvedArgs = { ...safeArgs, photoIds: resolution.photoIds };
      return sendEmail(resolvedArgs, userId);
    }

    case "sendWhatsApp": {
      const resolution = resolvePhotoReferences(session, safeArgs.photoIds);
      if (!resolution.success) {
        return { success: false, error: resolution.error };
      }
      const resolvedArgs = { ...safeArgs, photoIds: resolution.photoIds };
      return sendWhatsApp(resolvedArgs, userId);
    }

    case "requestZipConfirmation":
      return requestZipConfirmation(safeArgs);

    default:
      throw new Error(`Unknown tool "${toolName}"`);
  }
}
