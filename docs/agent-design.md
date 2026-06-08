# Agent Loop and Tool Calling Design

This document details the Groq agent configuration, tool definitions, session state structures, state injection strategies, and robust failure handling.

---

## 1. Groq Tool Definitions

The Groq agent is provided with four functional tools. These schemas are parsed by Groq to validate parameters before dispatching tool calls to the Express application.

### Tool: `searchPhotos`
Finds photos for specific people, dates, or tags.
```json
{
  "name": "searchPhotos",
  "description": "Find photos matching person names, date range, or event name. Returns an array of matching photo objects.",
  "parameters": {
    "type": "object",
    "properties": {
      "people": {
        "type": "array",
        "description": "List of person names to filter by.",
        "items": { "type": "string" }
      },
      "dateRange": {
        "type": "object",
        "description": "Optional ISO date filters.",
        "properties": {
          "start": { "type": "string", "description": "ISO start date string (YYYY-MM-DD)" },
          "end": { "type": "string", "description": "ISO end date string (YYYY-MM-DD)" }
        }
      },
      "event": {
        "type": "string",
        "description": "Optional descriptive tag representing the event (e.g. 'Diwali', 'Birthday')."
      }
    }
  }
}
```

### Tool: `getPeople`
Retrieves all known labeled persons in the user's database.
```json
{
  "name": "getPeople",
  "description": "List all labeled persons associated with the user's account.",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

### Tool: `sendEmail`
Sends a set of photos to a specific recipient via email.
```json
{
  "name": "sendEmail",
  "description": "Send photos to a specified Gmail address.",
  "parameters": {
    "type": "object",
    "properties": {
      "recipient": { "type": "string", "description": "Valid destination email address." },
      "photoIds": {
        "type": "array",
        "description": "Optional list of MongoDB photo ObjectIDs. If empty, the backend will auto-inject the last searched photo IDs.",
        "items": { "type": "string" }
      }
    },
    "required": ["recipient"]
  }
}
```

### Tool: `sendWhatsApp`
Sends a WhatsApp message containing links to the requested photos.
```json
{
  "name": "sendWhatsApp",
  "description": "Send photos to a target phone number using WhatsApp.",
  "parameters": {
    "type": "object",
    "properties": {
      "recipient": { "type": "string", "description": "Destination phone number in international format without '+' (e.g. '919876543210')." },
      "photoIds": {
        "type": "array",
        "description": "Optional list of MongoDB photo ObjectIDs. If empty, the backend will auto-inject the last searched photo IDs.",
        "items": { "type": "string" }
      }
    },
    "required": ["recipient"]
  }
}
```

---

## 2. Session Memory Layout

Conversation and operational states are cached per user in Redis with a 24-hour TTL.

```json
{
  "messages": [
    { "role": "user", "content": "Show me Dad's photos from last week" },
    { "role": "assistant", "tool_calls": [ { "id": "call_1", "type": "function", "function": { "name": "searchPhotos", "arguments": "{\"people\":[\"Dad\"]}" } } ] },
    { "role": "tool", "tool_call_id": "call_1", "content": "[{\"_id\":\"60c72...\",\"url\":\"...\"}]" },
    { "role": "assistant", "content": "I found 2 photos of Dad." }
  ],
  "memory": {
    "lastPhotoSearch": {
      "people": ["Dad"],
      "dateRange": null,
      "event": null,
      "photoIds": ["60c72b2f9b1d8b2bad689a22", "60c72b2f9b1d8b2bad689a23"]
    },
    "lastDelivery": {
      "recipient": "mom@example.com",
      "medium": "email"
    }
  }
}
```

---

## 3. Agent Loop Logic (Pseudocode)

```javascript
async function executeAgent(userMessage, sessionId) {
  // 1. Fetch Session from Redis
  let session = await redis.get(`session:${sessionId}`);
  if (!session) {
    session = { messages: [], memory: { lastPhotoSearch: null, lastDelivery: null } };
  }

  // 2. Append User input to chat history
  session.messages.push({ role: "user", content: userMessage });

  // 3. Select model (llama-3.1-8b-instant for simple queries, llama-3.3-70b-versatile if containing tool patterns)
  const selectedModel = routeModel(userMessage);

  // 4. Initialize Bounded Tool Calling Loop
  let response = await groq.chat.completions.create({
    model: selectedModel,
    messages: session.messages,
    tools: TOOL_DEFINITIONS,
    tool_choice: "auto"
  });

  const MAX_TOOL_DEPTH = parseInt(process.env.MAX_TOOL_DEPTH) || 5;
  for (let i = 0; i < MAX_TOOL_DEPTH; i++) {
    const choice = response.choices[0];
    if (choice.finish_reason !== "tool_calls") {
      break; 
    }

    const toolCalls = choice.message.tool_calls;
    session.messages.push(choice.message); // Append assistant intent

    for (const call of toolCalls) {
      let args = JSON.parse(call.function.arguments);
      
      // Target state injections (Reference Resolution)
      if ((call.function.name === "sendEmail" || call.function.name === "sendWhatsApp") && (!args.photoIds || args.photoIds.length === 0)) {
        if (session.memory.lastPhotoSearch && session.memory.lastPhotoSearch.photoIds.length > 0) {
          args.photoIds = session.memory.lastPhotoSearch.photoIds;
        }
      }

      // Execute & catch tool logic
      const result = await executeToolHandler(call.function.name, args, session);

      // Append tool execution response
      session.messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result)
      });
      
      // Update persistent search memory
      if (call.function.name === "searchPhotos") {
        session.memory.lastPhotoSearch = {
          people: args.people || [],
          dateRange: args.dateRange || null,
          event: args.event || null,
          photoIds: result.map(p => p.id)
        };
      }
    }

    // Call LLM with tool updates
    response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Force larger model for reasoning over tool logs
      messages: session.messages,
      tools: TOOL_DEFINITIONS
    });
  }

  // 5. Trim History & Save back to Redis
  session.messages.push(response.choices[0].message);
  
  const MAX_HISTORY = parseInt(process.env.MAX_HISTORY) || 20;
  if (session.messages.length > MAX_HISTORY) {
    session.messages = session.messages.slice(-MAX_HISTORY);
  }

  await redis.setex(`session:${sessionId}`, 86400, JSON.stringify(session));
  return response.choices[0].message.content;
}
```

---

## 4. Failure Handling Strategies

### A. Tool Parameter Validation
- **Type Coercion:** If the model sends `people: "Dad"` (string) instead of `["Dad"]` (array), the tool execution layer automatically coerces it to an array before querying.
- **Email/Phone Format Checks:** The email tool parses the recipient address with a standard regex; the WhatsApp tool strips any symbol formatting (e.g. `+` or `-`).
- **Validation Failures:** If validation fails (e.g., malformed email), the tool does not throw an API exception. It returns a descriptive string back to the LLM (e.g., `{"error": "Invalid email address format. Ask the user for clarification."}`).

### B. Tool Execution Failures
- **Graceful Catch-Alls:** All tool call executions are wrapped in individual `try/catch` statements.
- **Masking Stack Traces:** If a tool query or external call throws an error, the backend catches the error, logs the trace locally, and passes `{"error": "Database query timed out."}` to the LLM. This prevents exposure of sensitive connection traces.
- **LLM Context Recovery:** Since the tool results contain error messages, the LLM is given the context to explain the issue to the user and request actions gracefully.

### C. Agent Loop Safety Limits
- **Runaway Prevention:** The loop is strictly limited to `MAX_TOOL_DEPTH` (default `5`) steps. If it hits this ceiling, the system breaks out, returns the client the best available output, and logs an alarm.
- **History Pruning:** The memory size is capped at `MAX_HISTORY` messages. Pruning slices off the oldest messages while keeping system context intact.
- **Python Microservice Failures:** The node server checks the Python service's health via `/health` on API start. If it's down, background uploads refuse to queue job workers, updating photo statuses to `failed: service_unavailable` and warning the user.

### D. Session Corruption Recovery
- **Safe Session Deserialization:** Reading from Redis uses `try/catch`. If `JSON.parse()` fails (corrupt session), a warning is logged, the existing key is cleared, and a clean session dictionary is initialized. The user's application does not crash.
