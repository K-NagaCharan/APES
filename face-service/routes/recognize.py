from flask import Blueprint, request, jsonify, current_app
from services.face_service import recognize_faces

recognize_bp = Blueprint("recognize", __name__)

@recognize_bp.route("/recognize", methods=["POST"])
def recognize():
    """
    POST /recognize endpoint.
    Accepts imageUrl in request body, downloads it, detects faces,
    extracts embeddings, and returns a formatted list of faces.
    """
    try:
        # Check if the request contains valid JSON
        if not request.is_json:
            return jsonify({
                "status": "error",
                "message": "Invalid request payload. Expected JSON."
            }), 400
            
        data = request.get_json() or {}
        image_url = data.get("imageUrl")
        
        # Validation: check if imageUrl exists and is a non-empty string
        if not image_url or not isinstance(image_url, str) or not image_url.strip():
            return jsonify({
                "status": "error",
                "message": "imageUrl is required and must be a non-empty string."
            }), 400
            
        # Call recognize_faces to download and extract
        try:
            results = recognize_faces(image_url)
        except (TimeoutError, ConnectionError, ValueError) as e:
            # Catch image download, connection, and decode failures as 400 Bad Request
            return jsonify({
                "status": "error",
                "message": f"Unable to download or decode image: {str(e)}"
            }), 400
            
        faces = []
        for face in results:
            embedding = face.get("embedding")
            
            # Verify embedding size is exactly 512 dimensions for cosine similarity compatibility
            if not embedding or not isinstance(embedding, list) or len(embedding) != 512:
                continue
                
            # Map face parameters to our target API contract
            bbox = {
                "x": face["facial_area"]["x"],
                "y": face["facial_area"]["y"],
                "w": face["facial_area"]["w"],
                "h": face["facial_area"]["h"]
            }
            
            faces.append({
                "embedding": embedding,
                "bbox": bbox
            })
            
        return jsonify({"faces": faces}), 200
        
    except Exception as e:
        current_app.logger.exception(e)
        return jsonify({
            "status": "error",
            "message": "Internal server error"
        }), 500
