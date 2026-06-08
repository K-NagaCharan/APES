# APES — System Architecture

This document describes the high-level design, component boundaries, and core workflows of the APES (Agentic Photos Evaluation and Segregation) AI-powered photo management system.

## 1. System Overview

APES is built as a polyglot microservice architecture designed to handle photo storage, automatic face recognition, natural language retrieval, and action dispatching.

```mermaid
graph TD
    Client[React Client Vite] <-->|HTTP / Socket.io| Backend[Express API Server Node.js]
    Backend <-->|Session / Queue| Redis[(Redis / BullMQ)]
    Backend <-->|Metadata / Logs| Mongo[(MongoDB Atlas)]
    Backend -->|Internal HTTP| FaceService[Face Service Python / Flask]
    Backend -->|Media Store| Cloudinary[Cloudinary CDN]
    Backend -->|Delivery| Email[Nodemailer SMTP]
    Backend -->|Delivery| WA[whatsapp-web.js]
    Backend <-->|LLM Queries| Groq[Groq LPU API]
```

### Component Boundaries
- **React Client (Vite):** Visualizer layer. Standard React SPA, styling done via Tailwind. Renders the gallery, overlay canvas for face labeling, real-time toast alerts, and a chat interface. Communicates via Socket.io and Axios.
- **Express API (Node.js):** The orchestration core. Owns the REST API, websocket channels (via Socket.io), session routing, database schemas (via Mongoose), and the agent loop.
- **Python Face Service (Flask):** The machine learning processor. Wrapped in a simple Flask wrapper. Accepts image URLs, runs RetinaFace to localise bounding boxes, and generates 512-dimensional float embeddings using FaceNet512.
- **Redis (Upstash/Local):** Serves two distinct namespaces:
  1. *BullMQ Job Queues:* Organises asynchronous tasks for face extraction, email sending, and WhatsApp delivery.
  2. *Session Store:* Caches chat history and state contexts with a 24-hour TTL.
- **MongoDB Atlas:** Ephemeral-to-persistent storage. Holds records for users, photos, faces, named people, and delivery/chat audits.

---

## 2. Core Workflows

### Workflow A: Photo Upload & Processing Pipeline
When a user uploads a batch of files, the system processes them asynchronously using BullMQ workers.

```mermaid
sequenceDiagram
    autonumber
    actor User as React Client
    participant API as Express API
    participant Cloud as Cloudinary
    participant DB as MongoDB
    participant Queue as Redis (BullMQ)
    participant Worker as BullMQ Worker
    participant Python as Flask Face Service

    User->>API: POST /api/photos/upload (Multipart FormData)
    API->>Cloud: Upload image buffer
    Cloud-->>API: Return secure URL & public ID
    API->>DB: Save Photo Document (status: 'processing')
    API->>Queue: Add job to 'recognitionQueue' { photoId, imageUrl }
    API-->>User: Return 202 Accepted (jobId)
    
    Note over Worker: Background thread picks up job
    Worker->>Python: POST /recognize { imageUrl }
    Python->>Python: Fetch image + RetinaFace detection
    Python->>Python: Generate 512-float vector via FaceNet512
    Python-->>Worker: Return array of faces [ { bbox, embedding } ]
    
    loop Match Embeddings
        Worker->>DB: Load all existing Face embeddings for user
        Worker->>Worker: Calculate cosine similarity
        alt Match Found (> threshold)
            Worker->>DB: Save Face { personId, embedding, bbox, isLabeled: true }
        else No Match
            Worker->>DB: Save Face { personId: null, embedding, bbox, isLabeled: false }
            Worker->>API: Emit socket event 'face:new'
            API-->>User: Toast: Unknown face detected
        end
    end
    Worker->>DB: Update Photo status to 'completed'
    Worker->>API: Job complete event
    API-->>User: Emit socket event 'recognition:done'
```

---

### Workflow B: Agent Query & Action Flow
This workflow describes how a natural language request is routed, processed in a loop, and translated into backend actions.

```mermaid
sequenceDiagram
    autonumber
    actor User as React Client
    participant API as Express API (Agent Loop)
    participant Redis as Redis Session
    participant Groq as Groq LLM API
    participant Tools as Tool Handlers
    participant DB as MongoDB

    User->>API: POST /api/chat/message { message, sessionId }
    API->>Redis: Get session (messages history & search memory)
    API->>API: Determine routing (simple -> 8b, complex -> 70b)
    API->>Groq: Request completion (messages + tools definition)
    
    loop Agent Loop (Max 5 iterations)
        Groq-->>API: Finish Reason: 'tool_calls'
        API->>Tools: Parse arguments & execute tool (e.g. searchPhotos)
        Tools->>DB: Query Database
        Tools-->>API: Return stringified payload (e.g. [photoIds])
        API->>Redis: Update session.memory.lastPhotoSearch
        API->>API: Append tool result message to history
        API->>Groq: Request completion again
    end
    
    Groq-->>API: Finish Reason: 'stop' (Final response text)
    API->>DB: Save ChatHistory
    API->>Redis: Update session messages (TTL 24h)
    API-->>User: Stream response text & Socket.io event (if media results)
```
