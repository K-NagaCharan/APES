from flask import Flask
from flask_cors import CORS
from config import Config
from routes import health_bp, recognize_bp

def create_app():
    app = Flask(__name__)
    
    # Enable CORS for internal Node backend calls or direct checks
    CORS(app)
    
    # Register blueprints (routes)
    app.register_blueprint(health_bp)
    app.register_blueprint(recognize_bp)
    
    # Register custom error handlers
    @app.errorhandler(404)
    def not_found(e):
        return {"error": "Not Found"}, 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return {"error": "Method Not Allowed"}, 405
    
    return app

app = create_app()

if __name__ == "__main__":
    banner = f"""====================================
Face Service Started
Port: {Config.PORT}
Model: {Config.FACE_MODEL}
Detector: {Config.DETECTOR_BACKEND}
====================================
"""
    print(banner, flush=True)
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.LOG_LEVEL == "DEBUG")
