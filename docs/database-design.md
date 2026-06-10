# Database Design and Schemas

This document outlines the database schema definitions (via MongoDB / Mongoose) and the indexing strategy designed to scale queries.

---

## 1. Mongoose Schema Definitions

### Collection: `users`
Tracks registered users and authentication credentials.
```javascript
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true }, // Hashed using bcrypt
  createdAt: { type: Date, default: Date.now }
});
```

### Collection: `photos`
Holds uploaded image reference metadata.
```javascript
const PhotoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url: { type: String, required: true },               // Cloudinary CDN secure URL
  cloudinaryPublicId: { type: String, required: true }, // Used for deletion
  width: { type: Number },
  height: { type: Number },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  faceCount: { type: Number, default: 0 },
  uploadDate: { type: Date, default: Date.now }
});
```

### Collection: `people`
Represents named personas recognized by the system.
```javascript
const PersonSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true }, // Labeled name (e.g. "Dad", "Grandma")
  nameNormalized: { type: String, required: true, lowercase: true, trim: true },
  centroid: { type: [Number], default: null }, // Person embedding centroid vector (512-dim)
  centroidCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
```

### Collection: `faces`
Binds extracted vector embeddings and spatial coordinates to a Photo and Person.
```javascript
const FaceSchema = new mongoose.Schema({
  photoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo', required: true },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', default: null }, // Null if unlabeled
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  embedding: { type: [Number], required: true }, // 512-dimensional vector float array
  embeddingDimension: { type: Number, required: true, default: 512 },
  bbox: {
    x: { type: Number, required: true }, // Percentages or pixel coordinates
    y: { type: Number, required: true },
    w: { type: Number, required: true },
    h: { type: Number, required: true }
  },
  isLabeled: { type: Boolean, default: false },
  labelSource: { type: String, enum: ['manual', 'propagation'], default: null },
  createdAt: { type: Date, default: Date.now }
});
```

### Collection: `chathistories`
Provides persistent storage of chat context.
```javascript
const ChatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'tool'], required: true },
    content: { type: String },
    tool_calls: { type: Array },
    tool_call_id: { type: String }
  }],
  timestamp: { type: Date, default: Date.now }
});
```

### Collection: `deliveryhistories`
Audit logs tracking sent assets.
```javascript
const DeliveryHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: String, required: true },
  medium: { type: String, enum: ['email', 'whatsapp'], required: true },
  photoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo' }],
  status: { type: String, enum: ['queued', 'delivered', 'failed'], default: 'queued' },
  error: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});
```

---

## 2. Database Indexing Strategy

To maintain performance (latency <= 50ms) as data sizes increase, MongoDB indexes are defined as follows:

### `Face` Collection Indexes
* **`{ personId: 1 }`**
  * *Reason:* Critical for `searchPhotos` queries. Resolves photo searches for a known person (e.g. searching all Face documents matching Dad's `personId` to extract parent `photoId`s).
* **`{ photoId: 1 }`**
  * *Reason:* Supports joining detected faces onto photos. Vital when rendering image search results with bounding box overlays.
* **`{ isLabeled: 1 }`**
  * *Reason:* Used in the labeling UI to quickly find all detected faces that remain unidentified (`isLabeled: false`).
* **`{ userId: 1 }`**
  * *Reason:* Used to scope face records per user.

### `Photo` Collection Indexes
* **`{ userId: 1, uploadDate: -1 }`**
  * *Reason:* Powers the main gallery feed. Orders photos chronologically per authenticated user.
* **`{ userId: 1 }`**
  * *Reason:* Scopes all photo retrieval queries to the active user's environment.
* **`{ status: 1 }`**
  * *Reason:* Supports indexing processing/completed/failed status checks.

### `Person` Collection Indexes
* **`{ userId: 1, nameNormalized: 1 }` (Unique)**
  * *Reason:* Compound index to prevent duplicate named persons for the same user.

### `DeliveryHistory` Indexes
* **`{ userId: 1, createdAt: -1 }`**
  * *Reason:* Resolves temporal queries such as "what did I send yesterday?".

### `ChatHistory` Indexes
* **`{ userId: 1, timestamp: -1 }`**
  * *Reason:* Fetches recent conversation transcripts on startup.
