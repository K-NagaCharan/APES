# API Contracts

This document specifies the REST endpoint structures, request/response models, internal service contracts, and Socket.io event schemas.

---

## 1. Authentication Endpoints

All public endpoints are prefixed with `/api`. Protected routes require a `Bearer <JWT>` header in the format `Authorization: Bearer <Token>`.

### Register User
* **Path:** `POST /api/auth/register`
* **Auth Required:** No
* **Request Body:**
```json
{
  "username": "johndoe",
  "email": "johndoe@example.com",
  "password": "strongpassword123"
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": {
    "id": "60c72b2f9b1d8b2bad689a10",
    "username": "johndoe",
    "email": "johndoe@example.com"
  }
}
```
* **Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Email is already registered"
}
```

### Login User
* **Path:** `POST /api/auth/login`
* **Auth Required:** No
* **Request Body:**
```json
{
  "email": "johndoe@example.com",
  "password": "strongpassword123"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": {
    "id": "60c72b2f9b1d8b2bad689a10",
    "username": "johndoe",
    "email": "johndoe@example.com"
  }
}
```
* **Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

### Current User Profile
* **Path:** `GET /api/auth/me`
* **Auth Required:** Yes
* **Success Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "60c72b2f9b1d8b2bad689a10",
    "username": "johndoe",
    "email": "johndoe@example.com"
  }
}
```

---

## 2. Photo Management Endpoints

### Upload Photo
* **Path:** `POST /api/photos/upload`
* **Auth Required:** Yes
* **Request Content-Type:** `multipart/form-data`
* **Body Form Data:** `file` (Binary Image File)
* **Success Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Photo uploaded successfully. Processing queued.",
  "photo": {
    "id": "60c72b2f9b1d8b2bad689a22",
    "url": "https://res.cloudinary.com/demo/image/upload/v1234/apes/photo.jpg",
    "status": "processing"
  },
  "jobId": "bullmq-job-12345"
}
```

### List Photos
* **Path:** `GET /api/photos`
* **Auth Required:** Yes
* **Query Parameters:**
  - `limit` (number, default 30)
  - `skip` (number, default 0)
* **Success Response (200 OK):**
```json
{
  "success": true,
  "photos": [
    {
      "id": "60c72b2f9b1d8b2bad689a22",
      "url": "https://res.cloudinary.com/demo/image/upload/v1234/apes/photo.jpg",
      "status": "completed",
      "createdAt": "2026-06-08T10:00:00.000Z"
    }
  ]
}
```

### Delete Photo
* **Path:** `DELETE /api/photos/:id`
* **Auth Required:** Yes
* **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Photo deleted successfully"
}
```

---

## 3. Face & People Labeling Endpoints

### Get Labeled People
* **Path:** `GET /api/people`
* **Auth Required:** Yes
* **Success Response (200 OK):**
```json
{
  "success": true,
  "people": [
    {
      "id": "60c72b2f9b1d8b2bad689a99",
      "name": "Mom"
    },
    {
      "id": "60c72b2f9b1d8b2bad689a88",
      "name": "Dad"
    }
  ]
}
```

### Label Face
* **Path:** `POST /api/people/label`
* **Auth Required:** Yes
* **Request Body:**
```json
{
  "faceId": "60c72b2f9b1d8b2bad689a55",
  "name": "Dad"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "face": {
    "id": "60c72b2f9b1d8b2bad689a55",
    "photoId": "60c72b2f9b1d8b2bad689a22",
    "personId": "60c72b2f9b1d8b2bad689a88",
    "isLabeled": true
  },
  "person": {
    "id": "60c72b2f9b1d8b2bad689a88",
    "name": "Dad"
  }
}
```

---

## 4. Chat Endpoints

### Query Message
* **Path:** `POST /api/chat/message`
* **Auth Required:** Yes
* **Request Body:**
```json
{
  "message": "Show me Dad's photos from last Diwali",
  "sessionId": "user-session-uuid-123"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "response": "Here are Dad's photos from Diwali 2023.",
  "metadata": {
    "photosFoundCount": 3,
    "recipient": null,
    "medium": null
  }
}
```

### Chat History
* **Path:** `GET /api/chat/history`
* **Auth Required:** Yes
* **Success Response (200 OK):**
```json
{
  "success": true,
  "history": [
    {
      "id": "60c72b2f9b1d8b2bad689ae1",
      "sessionId": "user-session-uuid-123",
      "role": "user",
      "content": "Show me Dad's photos",
      "createdAt": "2026-06-08T10:10:00.000Z"
    },
    {
      "id": "60c72b2f9b1d8b2bad689ae2",
      "sessionId": "user-session-uuid-123",
      "role": "assistant",
      "content": "Found 3 photos of Dad.",
      "createdAt": "2026-06-08T10:10:01.000Z"
    }
  ]
}
```

---

## 5. Delivery Audit Logs Endpoints

### Get Delivery History
* **Path:** `GET /api/delivery/history`
* **Auth Required:** Yes
* **Success Response (200 OK):**
```json
{
  "success": true,
  "deliveries": [
    {
      "id": "60c72b2f9b1d8b2bad689cc3",
      "recipient": "mom@gmail.com",
      "medium": "email",
      "photoIds": ["60c72b2f9b1d8b2bad689a22"],
      "status": "delivered",
      "createdAt": "2026-06-08T10:15:00.000Z"
    }
  ]
}
```

---

## 6. Internal Face Service Contract (Node.js -> Python)

### Recognize Faces
* **Path:** `POST /recognize`
* **Endpoint URL:** `http://localhost:8001/recognize`
* **Request Body:**
```json
{
  "imageUrl": "https://res.cloudinary.com/demo/image/upload/v1234/apes/photo.jpg"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "faces": [
    {
      "bbox": {
        "x": 120,
        "y": 80,
        "w": 50,
        "h": 50
      },
      "embedding": [0.0123, -0.0456, 0.0890, "...", 0.0021] 
    }
  ]
}
```

### Health Check
* **Path:** `GET /health`
* **Endpoint URL:** `http://localhost:8001/health`
* **Success Response (200 OK):**
```json
{
  "status": "healthy",
  "model": "Facenet512",
  "detector": "retinaface"
}
```

---

## 7. Socket.io Event Contract (Server -> Client)

All server-to-client events are scoped to the authenticated user's private room: `socket.to(userId)`.

| Event Name | Payload Shape | When Emitted |
| :--- | :--- | :--- |
| `recognition:progress` | `{"jobId": String, "done": Number, "total": Number, "photoId": String}` | Emitted after a single image finishes processing in a batch upload job. |
| `face:new` | `{"faceId": String, "photoId": String, "imageUrl": String, "bbox": Object}` | Emitted immediately when an unknown/unlabeled face is detected in an uploaded image. |
| `recognition:done` | `{"jobId": String, "totalProcessed": Number, "newFacesCount": Number}` | Emitted when all images in a queued batch upload job are processed. |
| `delivery:done` | `{"deliveryId": String, "medium": "email" \| "whatsapp", "recipient": String, "count": Number}` | Emitted when the delivery worker successfully dispatches the photos. |
| `delivery:failed` | `{"medium": "email" \| "whatsapp", "recipient": String, "error": String}` | Emitted when the background delivery worker fails to send the dispatch. |
