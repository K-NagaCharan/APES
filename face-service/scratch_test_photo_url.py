import sys
import numpy as np
import requests
import cv2
from PIL import Image, ImageOps
import io
from services.face_service import extract_embeddings
from insightface.app import FaceAnalysis

def download_image_raw(url):
    headers = {
        "User-Agent": "Mozilla/5.0"
    }
    response = requests.get(url, headers=headers, timeout=20)
    response.raise_for_status()
    return response.content

def main():
    urls = [
        "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781155661/apes/photos/qkctvuikut6yrut404rw.jpg",
        "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781155653/apes/photos/iwqi1jpqwchww9kbyrut.jpg",
        "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781155643/apes/photos/ddckr4ps5m5ogaud6e25.jpg"
    ]
    
    app = FaceAnalysis(name="buffalo_l")
    # Use the configured size (1024, 1024)
    app.prepare(ctx_id=-1, det_size=(1024, 1024))
    
    for idx, url in enumerate(urls):
        print(f"\n--- Testing Photo {idx+1}: {url} ---")
        content = download_image_raw(url)
        
        # Original PIL orientation info
        pil_img = Image.open(io.BytesIO(content))
        print(f"  Original PIL Size: {pil_img.size}")
        
        # Transposed PIL image (upright)
        pil_img_transposed = ImageOps.exif_transpose(pil_img)
        print(f"  Transposed PIL Size: {pil_img_transposed.size}")
        
        # Test on the transposed image (upright)
        img_upright = cv2.cvtColor(np.array(pil_img_transposed), cv2.COLOR_RGB2BGR)
        faces_upright = app.get(img_upright)
        print(f"  [Transposed Image] Detected {len(faces_upright)} faces.")
        for i, face in enumerate(faces_upright):
            bbox = face.bbox.astype(int).tolist()
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            score = getattr(face, "det_score", 0.0)
            print(f"    Face {i+1}: BBox={bbox}, det_score={score:.4f}, size={w}x{h}")
            
        # Test on the raw image (no transpose)
        img_raw = cv2.imdecode(np.asarray(bytearray(content), dtype=np.uint8), cv2.IMREAD_COLOR)
        faces_raw = app.get(img_raw)
        print(f"  [Raw OpenCV Image] Detected {len(faces_raw)} faces.")
        for i, face in enumerate(faces_raw):
            bbox = face.bbox.astype(int).tolist()
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            score = getattr(face, "det_score", 0.0)
            print(f"    Face {i+1}: BBox={bbox}, det_score={score:.4f}, size={w}x{h}")

if __name__ == "__main__":
    main()
