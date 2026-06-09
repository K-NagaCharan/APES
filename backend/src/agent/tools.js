/**
 * Tool definitions for the AI Agent loop.
 * These are Groq-compatible JSON Schema tool specifications.
 */
export const TOOLS = [
  {
    type: "function",
    function: {
      name: "searchPhotos",
      description: "Search the user's photo collection using structured filters.",
      parameters: {
        type: "object",
        properties: {
          people: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Names of labeled people to filter photos by."
          },
          fromDate: {
            type: "string",
            description: "Start date for filtering photos in ISO format (YYYY-MM-DD)."
          },
          toDate: {
            type: "string",
            description: "End date for filtering photos in ISO format (YYYY-MM-DD)."
          },
          location: {
            type: "string",
            description: "Location name where photos were taken."
          },
          event: {
            type: "string",
            description: "Event description or name associated with photos."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getPeople",
      description: "Return the list of labeled people belonging to the authenticated user.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sendEmail",
      description: "Send photos via email.",
      parameters: {
        type: "object",
        properties: {
          photoIds: {
            type: "array",
            items: {
              type: "string"
            },
            minItems: 1,
            description: "Array of MongoDB photo IDs to email."
          },
          email: {
            type: "string",
            format: "email",
            description: "The recipient's email address."
          }
        },
        required: ["photoIds", "email"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sendWhatsApp",
      description: "Send photos through WhatsApp.",
      parameters: {
        type: "object",
        properties: {
          photoIds: {
            type: "array",
            items: {
              type: "string"
            },
            minItems: 1,
            description: "Array of MongoDB photo IDs to send."
          },
          phoneNumber: {
            type: "string",
            description: "The recipient's WhatsApp phone number in international format."
          }
        },
        required: ["photoIds", "phoneNumber"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "requestZipConfirmation",
      description: "Ask the frontend whether the user approves ZIP compression when delivery exceeds platform limits.",
      parameters: {
        type: "object",
        properties: {
          deliveryMethod: {
            type: "string",
            enum: ["email", "whatsapp"],
            description: "The delivery method chosen by the user."
          },
          estimatedSizeMB: {
            type: "number",
            description: "The estimated total size in megabytes of the photos to be sent."
          }
        },
        required: ["deliveryMethod", "estimatedSizeMB"],
        additionalProperties: false
      }
    }
  }
];
