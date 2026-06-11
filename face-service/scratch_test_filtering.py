import sys
from services.face_service import extract_embeddings
from utils.image_utils import download_image

def main():
    # Load a test image containing faces (Unsplash friends group portrait)
    url = "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1000&q=80"
    print(f"Downloading test image from: {url}")
    img = download_image(url)
    
    print("Extracting embeddings with filtering...")
    results = extract_embeddings(img)
    print(f"Successfully extracted {len(results)} faces after filtering.")
    for i, res in enumerate(results):
        area = res["facial_area"]
        print(f"  Face {i+1}: area {area}")
        assert area["w"] >= 35 and area["h"] >= 35, "Face size filtering failed!"
        
    print("Filtering verification PASSED!")

if __name__ == "__main__":
    main()
