import requests
import cv2
import numpy as np

def download_image(url, timeout=20):
    """
    Downloads an image from a URL and decodes it using OpenCV.
    
    Args:
        url (str): The URL of the image to download.
        timeout (int): Network timeout limit in seconds.
        
    Returns:
        numpy.ndarray: The decoded BGR image array.
        
    Raises:
        TimeoutError: If connection to image host times out.
        ConnectionError: If network request fails.
        ValueError: If data cannot be decoded as a valid image.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
    except requests.exceptions.Timeout as e:
        raise TimeoutError("Connection to image host timed out") from e
    except requests.exceptions.RequestException as e:
        raise ConnectionError(f"Failed to retrieve image: {str(e)}") from e
        
    try:
        image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    except Exception as e:
        raise ValueError(f"Failed to parse image data: {str(e)}") from e
        
    if img is None:
        raise ValueError("Downloaded data could not be decoded as a valid image")
        
    return img
