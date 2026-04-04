"""
scan_card.py - Called by Next.js API route via subprocess.
Usage: python scan_card.py <image_path>
Outputs: JSON to stdout
"""
import sys
import json
import re
import cv2
import numpy as np
import easyocr
from deep_translator import GoogleTranslator

reader = easyocr.Reader(['ja', 'en'], gpu=False, verbose=False)

IGNORE_WORDS = {
    'basic', 'stage', 'stage1', 'stage2', 'ex', 'gx', 'vmax', 'vstar', 'v',
    'hp', 'retreat', 'weakness', 'resistance', 'evolves', 'from', 'pokemon',
    'trainer', 'supporter', 'item', 'stadium', 'energy', 'special',
    'attack', 'damage', 'ability', 'rule', 'prize', 'draw', 'card',
    'put', 'your', 'deck', 'hand', 'discard', 'pile', 'bench', 'active',
    'no.', 'ht', 'wt', 'lbs', 'illus', 'when', 'this', 'that', 'with',
}

def is_pokemon_name(text: str) -> bool:
    clean = text.strip().lower()
    if not clean or clean in IGNORE_WORDS:
        return False
    if re.fullmatch(r'[\d\s/\.\-\+\*\(\)⚡★☆●]+', clean):
        return False
    if len(clean) < 2:
        return False
    return True

def extract_card_name(image):
    height, width = image.shape[:2]
    name_area = image[0:int(0.20 * height), int(0.12 * width):int(0.80 * width)]
    name_area = cv2.resize(name_area, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    blurred = cv2.GaussianBlur(name_area, (0, 0), 3)
    name_area = cv2.addWeighted(name_area, 1.5, blurred, -0.5, 0)

    results = reader.readtext(name_area)
    if not results:
        return None, None

    candidates = []
    for (bbox, text, conf) in results:
        if conf < 0.3 or not is_pokemon_name(text):
            continue
        pts = np.array(bbox)
        area = cv2.contourArea(pts)
        candidates.append((area, conf, text))

    if not candidates:
        best = max(results, key=lambda x: x[2])
        raw = best[1].strip()
    else:
        candidates.sort(reverse=True)
        raw = candidates[0][2].strip()

    if re.search(r'[\u3000-\u9fff]', raw):
        try:
            english = GoogleTranslator(source='auto', target='en').translate(raw)
        except Exception:
            english = raw
        return raw, english
    else:
        return raw, raw.title()


def _ocr_number_region(crop):
    """Run OCR on a cropped region and extract a card number pattern like 025/165."""
    crop = cv2.resize(crop, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    gray = clahe.apply(gray)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    crop_bin = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)

    results = reader.readtext(crop_bin)
    full_text = ' '.join(t for _, t, _ in results)

    # Normalise common OCR mistakes before matching
    normalised = (full_text
        .replace('|', '/').replace('l', '1').replace('I', '1')
        .replace('O', '0').replace('o', '0').replace(' ', ''))

    match = re.search(r'(\d{1,4})/(\d{2,4})', normalised)
    if match:
        card_num = match.group(1).lstrip('0') or '0'
        card_total = match.group(2)
        return card_num, card_total
    return None, None


def extract_card_number(image):
    """Try bottom-left and bottom-right regions — number can appear in either."""
    height, width = image.shape[:2]

    # Bottom strip rows (same for both sides)
    y1, y2 = int(0.90 * height), int(0.99 * height)

    regions = [
        image[y1:y2, 0:int(0.55 * width)],           # bottom-left  (e.g. MEW/151 set)
        image[y1:y2, int(0.45 * width):width],        # bottom-right (older sets)
        image[y1:y2, int(0.20 * width):int(0.80 * width)],  # centre fallback
    ]

    for region in regions:
        num, total = _ocr_number_region(region)
        if num and total:
            return num, total

    return None, None


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No image path provided'}))
        sys.exit(1)

    image_path = sys.argv[1]
    image = cv2.imread(image_path)

    if image is None:
        print(json.dumps({'error': f'Could not read image: {image_path}'}))
        sys.exit(1)

    japanese_name, english_name = extract_card_name(image)
    card_number, card_total = extract_card_number(image)

    print(json.dumps({
        'japanese_name': japanese_name,
        'english_name': english_name,
        'card_number': card_number,
        'card_total': card_total,
    }))
