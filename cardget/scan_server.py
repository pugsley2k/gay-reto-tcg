from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import easyocr
from deep_translator import GoogleTranslator
import tempfile
import os

app = Flask(__name__)
CORS(app)

print("Loading Japanese OCR model (first run may take a moment)...")
reader = easyocr.Reader(['ja', 'en'], gpu=False)
print("OCR model ready.")

def extract_card_name(image):
    height, width = image.shape[:2]
    # Top ~18% of card is the name area
    name_area = image[0:int(0.18 * height), int(0.05 * width):int(0.85 * width)]
    name_area = cv2.resize(name_area, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    results = reader.readtext(name_area)
    if not results:
        return None, None

    # Pick highest-confidence result
    best = max(results, key=lambda x: x[2])
    japanese_text = best[1].strip()

    try:
        english_text = GoogleTranslator(source='auto', target='en').translate(japanese_text)
    except Exception:
        english_text = japanese_text

    return japanese_text, english_text

@app.route('/scan', methods=['POST'])
def scan():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']

    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
        tmp_path = tmp.name
        file.save(tmp_path)

    try:
        image = cv2.imread(tmp_path)
        if image is None:
            return jsonify({'error': 'Could not read image'}), 400

        japanese_name, english_name = extract_card_name(image)

        return jsonify({
            'japanese_name': japanese_name,
            'english_name': english_name,
        })
    finally:
        os.unlink(tmp_path)

if __name__ == '__main__':
    print("Scan server running on http://localhost:5001")
    app.run(port=5001, debug=False)
