import sys
import numpy as np
import requests
import cv2
from insightface.app import FaceAnalysis

def download_image(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    response = requests.get(url, headers=headers, timeout=20)
    response.raise_for_status()
    arr = np.asarray(bytearray(response.content), dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

def get_similarity(emb1, emb2):
    dot = np.dot(emb1, emb2)
    norm1 = np.linalg.norm(emb1)
    norm2 = np.linalg.norm(emb2)
    return dot / (norm1 * norm2)

def main():
    # Face A and Face B URLs from same person 'charan'
    url_a = "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781073776/apes/photos/oevj7l3w0fhavza9dr84.jpg"
    url_b = "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781076210/apes/photos/jkzgx8bkfzn3mlhfeze8.jpg"

    print("Downloading images...")
    img_a = download_image(url_a)
    img_b = download_image(url_b)
    print(f"Image A shape: {img_a.shape}, Image B shape: {img_b.shape}")

    sizes = [(640, 640), (1280, 1280)]

    for size in sizes:
        print(f"\n--- Testing det_size={size} ---")
        app = FaceAnalysis(name="buffalo_l")
        app.prepare(ctx_id=-1, det_size=size)
        
        faces_a = app.get(img_a)
        faces_b = app.get(img_b)

        print(f"Image A: detected {len(faces_a)} faces.")
        print(f"Image B: detected {len(faces_b)} faces.")

        # Find the main/largest face in each image
        if len(faces_a) > 0 and len(faces_b) > 0:
            face_a = max(faces_a, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
            face_b = max(faces_b, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))

            # Normal and normed embeddings
            sim_raw = get_similarity(face_a.embedding, face_b.embedding)
            sim_normed = get_similarity(face_a.normed_embedding, face_b.normed_embedding)
            
            print(f"Cosine Similarity (raw): {sim_raw:.4f}")
            print(f"Cosine Similarity (normed): {sim_normed:.4f}")
            print(f"BBox A: {face_a.bbox.tolist()}")
            print(f"BBox B: {face_b.bbox.tolist()}")
        else:
            print("Failed to detect faces in one or both images with this det_size.")

if __name__ == "__main__":
    main()
