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
    url_a = "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781073776/apes/photos/oevj7l3w0fhavza9dr84.jpg"
    url_b = "https://res.cloudinary.com/dxgl7wq2e/image/upload/v1781076210/apes/photos/jkzgx8bkfzn3mlhfeze8.jpg"

    img_a = download_image(url_a)
    img_b = download_image(url_b)

    sizes = [(640, 640), (1280, 1280)]

    for size in sizes:
        print(f"\n--- det_size={size} ---")
        app = FaceAnalysis(name="buffalo_l")
        app.prepare(ctx_id=-1, det_size=size)
        
        faces_a = app.get(img_a)
        faces_b = app.get(img_b)

        print(f"Image A: {len(faces_a)} faces detected. Image B: {len(faces_b)} faces detected.")

        for i, face_a in enumerate(faces_a):
            bbox_a = face_a.bbox.astype(int).tolist()
            w_a, h_a = bbox_a[2] - bbox_a[0], bbox_a[3] - bbox_a[1]
            x_a, y_a = bbox_a[0], bbox_a[1]
            print(f"  Face A{i}: bbox [x:{x_a}, y:{y_a}, w:{w_a}, h:{h_a}]")
            for j, face_b in enumerate(faces_b):
                bbox_b = face_b.bbox.astype(int).tolist()
                w_b, h_b = bbox_b[2] - bbox_b[0], bbox_b[3] - bbox_b[1]
                x_b, y_b = bbox_b[0], bbox_b[1]
                
                sim = get_similarity(face_a.normed_embedding, face_b.normed_embedding)
                print(f"    vs Face B{j} [x:{x_b}, y:{y_b}, w:{w_b}, h:{h_b}] => Similarity: {sim:.4f}")

if __name__ == "__main__":
    main()
