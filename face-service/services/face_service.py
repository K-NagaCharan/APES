from insightface.app import FaceAnalysis
from config import Config
from utils.image_utils import download_image
import numpy as np

# Initialize FaceAnalysis (Buffalo_L) once
app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=-1, det_size=(640, 640))

def compute_iou(box1, box2):
    """
    Computes Intersection over Union (IoU) of two bounding boxes.
    Each box is in [x_min, y_min, x_max, y_max] format.
    """
    x_min1, y_min1, x_max1, y_max1 = box1
    x_min2, y_min2, x_max2, y_max2 = box2
    
    inter_x_min = max(x_min1, x_min2)
    inter_y_min = max(y_min1, y_min2)
    inter_x_max = min(x_max1, x_max2)
    inter_y_max = min(y_max1, y_max2)
    
    if inter_x_max <= inter_x_min or inter_y_max <= inter_y_min:
        return 0.0
        
    inter_area = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)
    area1 = (x_max1 - x_min1) * (y_max1 - y_min1)
    area2 = (x_max2 - x_min2) * (y_max2 - y_min2)
    
    union_area = area1 + area2 - inter_area
    if union_area == 0:
        return 0.0
        
    return inter_area / union_area

def deduplicate_faces(faces, threshold=0.70):
    """
    Applies Non-Maximum Suppression (NMS) based on IoU threshold to deduplicate detections.
    Detections are sorted by det_score in descending order.
    """
    sorted_faces = sorted(faces, key=lambda f: getattr(f, "det_score", 0.0), reverse=True)
    
    keep = []
    for face in sorted_faces:
        discard = False
        for kept_face in keep:
            iou = compute_iou(face.bbox, kept_face.bbox)
            if iou > threshold:
                discard = True
                break
        if not discard:
            keep.append(face)
    return keep

def extract_embeddings(img):
    """
    Executes InsightFace represent function to extract face embeddings and bounding boxes.
    
    Args:
        img (numpy.ndarray): OpenCV BGR image array.
        
    Returns:
        list: List of detected face representation dictionaries.
    """
    try:
        faces = app.get(img)
        faces = deduplicate_faces(faces, threshold=0.70)
        
        results = []
        for face in faces:
            # bbox is [x_min, y_min, x_max, y_max]
            bbox = face.bbox
            x = int(bbox[0])
            y = int(bbox[1])
            w = int(bbox[2] - bbox[0])
            h = int(bbox[3] - bbox[1])
            
            # Convert embedding numpy array to a list
            embedding = face.embedding.tolist()
            
            results.append({
                "embedding": embedding,
                "facial_area": {
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h
                }
            })
            
        return results
    except Exception as e:
        raise e

def recognize_faces(image_url):
    """
    Downloads image and extracts face embeddings.
    
    Args:
        image_url (str): Image public URL.
        
    Returns:
        list: Normalized list of representation dictionaries.
    """
    img = download_image(image_url)
    return extract_embeddings(img)
