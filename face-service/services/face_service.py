from deepface import DeepFace
from config import Config
from utils.image_utils import download_image

def extract_embeddings(img):
    """
    Executes DeepFace represent function to extract face embeddings and bounding boxes.
    
    Args:
        img (numpy.ndarray): OpenCV BGR image array.
        
    Returns:
        list: List of detected face representation dictionaries.
    """
    try:
        results = DeepFace.represent(
            img_path=img,
            model_name=Config.FACE_MODEL,
            detector_backend=Config.DETECTOR_BACKEND,
            enforce_detection=True
        )
        
        # Normalize to list format for consistency
        if not isinstance(results, list):
            results = [results]
            
        return results
    except ValueError as e:
        # Check if the ValueError is due to face detection failing
        err_msg = str(e).lower()
        if "face could not be detected" in err_msg or "face_detection" in err_msg:
            return []
        # Re-raise any other ValueErrors (e.g. invalid img format)
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
