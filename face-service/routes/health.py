from flask import Blueprint, jsonify, current_app
from config import Config

health_bp = Blueprint("health", __name__)

@health_bp.route("/health", methods=["GET"])
def health_check():
    """Endpoint checking microservice health and active models."""
    try:
        return jsonify({
            "status": "healthy",
            "service": "face-service",
            "model": Config.FACE_MODEL,
            "detector": Config.DETECTOR_BACKEND
        }), 200
    except Exception as e:
        current_app.logger.exception(e)
        return jsonify({
            "status": "error",
            "message": "Internal server error"
        }), 500
