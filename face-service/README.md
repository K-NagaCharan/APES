# Face Recognition Microservice

This is the Python microservice responsible for running face detection and face embedding generation for the APES system. It uses [DeepFace](https://github.com/serengil/deepface) under the hood with `retinaface` for face bounding box localization and `Facenet512` for face vector similarity scoring.

## Project Structure

```
face-service/
│
├── app.py                # Server entry point
├── config.py             # Configuration loader
├── requirements.txt      # Python dependencies
├── README.md             # Setup and developer documentation
├── .env.example          # Environment variables template
├── .gitignore            # Git exclusion rules
├── __init__.py           # Root package identifier
│
├── routes/               # HTTP Controller/Route layers
│   ├── __init__.py
│   ├── health.py         # /health endpoint
│   └── recognize.py      # /recognize endpoint (placeholder)
│
├── services/             # Core business logic helpers
│   ├── __init__.py
│   └── face_service.py   # Face recognition algorithms (placeholder)
│
├── models/               # ML weights and model definitions
│   ├── __init__.py
│   └── model_loader.py   # Model download and caching loader (placeholder)
│
└── utils/                # Utility scripts
    ├── __init__.py
    └── logger.py         # Logging helpers (placeholder)
```

## Setup Guide

### 1. Create a Python Virtual Environment
We recommend using Python 3.10+ (specifically Python 3.13 is verified). Run the following command inside the `face-service/` directory:

```bash
python -m venv venv
```

### 2. Activate the Virtual Environment
Activate the environment based on your current terminal/shell:

*   **PowerShell (Windows):**
    ```powershell
    .\venv\Scripts\Activate.ps1
    ```
*   **CMD (Windows):**
    ```cmd
    .\venv\Scripts\activate.bat
    ```
*   **Bash/zsh (macOS/Linux):**
    ```bash
    source venv/bin/activate
    ```

### 3. Install Dependencies
Ensure you have the virtual environment activated, then install the required libraries:

```bash
pip install -r requirements.txt
```

### 4. Setup Local Environment Variables
Copy `.env.example` to a new `.env` file:

```bash
cp .env.example .env
```

You can customize options like `PORT`, `FACE_MODEL`, or `DETECTOR_BACKEND` here.

## Running the Server

To start the local development server, run:

```bash
python app.py
```

Upon boot, the console will print the startup configuration banner:

```
====================================
Face Service Started
Port: 5001
Model: Facenet512
Detector: retinaface
====================================
```

---

## API Endpoints

### 1. Health Status
Check if the microservice is operational and which models are active.

*   **Endpoint:** `GET /health`
*   **Response (200 OK):**
    ```json
    {
      "status": "healthy",
      "model": "Facenet512",
      "detector": "retinaface"
    }
    ```

### 2. Face Recognition (Future)
Process uploaded image to locate faces and generate vectors.

*   **Endpoint:** `POST /recognize`
*   **Status:** *Not Implemented (Task 3.3)*
*   **Expected Body:**
    ```json
    {
      "imageUrl": "https://res.cloudinary.com/demo/image/upload/v1234/apes/photo.jpg"
    }
    ```
*   **Expected Response (200 OK):**
    ```json
    {
      "success": true,
      "faces": [
        {
          "bbox": { "x": 120, "y": 80, "w": 50, "h": 50 },
          "embedding": [0.0123, -0.0456, 0.0890, 0.0021]
        }
      ]
    }
    ```
