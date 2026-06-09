from flask import Blueprint, jsonify
from config import Config

health_bp = Blueprint("health", __name__)

@health_bp.route("/health", methods=["GET"])
def health_check():
    """Endpoint checking microservice health and active models."""
    return jsonify({
        "status": "healthy",
        "model": Config.FACE_MODEL,
        "detector": Config.DETECTOR_BACKEND
    }), 200
