# Engineering Decision Log

This document lists the architectural decisions made for Drishyamitra, the alternatives considered, and the technical justifications behind each selection.

---

| Core Decisional Area | Selection | Alternatives Considered | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Face Recognition Runtime** | **Python (DeepFace)** | `face-api.js` (Node) | FaceNet512 + RetinaFace model accuracy is superior to JS models under difficult lighting/angles. Keeping ML logic in Python mirrors standard production boundaries. |
| **Embedding Storage** | **MongoDB (Float Array)** | Qdrant, Pinecone | At a scale of <=10,000 faces, calculating cosine similarity in Node.js takes <=20ms. Avoids provisioning separate databases prematurely. |
| **Vector DB Scaling** | **Qdrant (v2 phase)** | MongoDB embeddings (permanently) | Deferring Qdrant prevents resume-padding. Qdrant is plan-scoped for v2 if database scale exceeds 50,000 embeddings. Schema design allows transparent query-layer migrations. |
| **Session & Chat Memory** | **Redis** | MongoDB | Session state has a 24-hour TTL, is highly mutable, and requires sub-millisecond reads. MongoDB's write overhead and disk persistence are unnecessary. |
| **Background Jobs Queue** | **BullMQ** | Celery, Synchronous API processing | Face detection takes 2-10 seconds per image. Synchronous API calls would block the event loop and crash HTTP requests. BullMQ is a Node-native, Redis-backed task manager. |
| **LLM Provider** | **Groq API** | OpenAI, Gemini | Groq's LPU provides ~800 tokens/sec, enabling real-time agent-loop performance. Offers a generous free tier for development. |
| **LLM Model Routing** | **Dual Model** | Single Model | Simple messages run on `llama-3.1-8b-instant` (low cost/latency). Complex messages containing actions use `llama-3.3-70b-versatile` (reliable tool-calling). |
| **Real-time Notifications** | **Socket.io** | Long Polling, SSE (Server-Sent Events) | BullMQ workers must push status changes (upload progress, unknown faces detected) back to clients asynchronously. Socket.io handles bidirectionality and scales well. |
| **Photo Assets Host** | **Cloudinary CDN** | AWS S3, Local storage | Cloudinary provides auto-image compression, simple URL transformations, and a robust free tier without IAM configuration overhead. |
| **Deployment Target** | **Managed Services (Railway / Vercel)** | Docker Compose on single VPS | Railway + Vercel deployment handles multi-service orchestration with zero operational overhead, allowing focus on core logic. |
| **Client UI Animations** | **Tailwind standard** | Framer Motion | Animations do not validate core agent or backend engineering capability. Priority is focused on queue execution and tool routing correctness. |

---

## Technical Trade-offs Acknowledged

### Polyglot Microservice Overhead
Managing two languages (Node.js and Python) adds operational complexity. This trade-off is accepted because DeepFace's accuracy gains over JS equivalents are critical to usability. The service boundaries are kept clean: Node.js communicates with Python solely through an internal port-to-port HTTP API.
