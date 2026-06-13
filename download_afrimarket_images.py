"""
Télécharge les images produits depuis Amazon CDN, les redimensionne
et les enregistre dans public/images/products/ pour AfriMarket (test/démo uniquement).

Usage:
    pip install requests pillow
    python download_afrimarket_images.py
"""
import os
import requests
from io import BytesIO
from PIL import Image

OUT_DIR = "public/images/products"
os.makedirs(OUT_DIR, exist_ok=True)

# (nom_fichier, url_image, categorie/shop)
PRODUCTS = [
    ("echo_dot.jpg", "https://m.media-amazon.com/images/I/71Tm9ZWZ5LL._AC_SX569_.jpg", "ÉlectroKin"),
    ("camera_securite.jpg", "https://m.media-amazon.com/images/I/71URjTfVbxL._AC_SY300_SX300_QL70_ML2_.jpg", "ÉlectroKin"),
    ("ipad.jpg", "https://m.media-amazon.com/images/I/616z23YvqML._AC_SX679_.jpg", "ÉlectroKin"),
    ("tv_tcl.jpg", "https://m.media-amazon.com/images/I/711w9kbaOCL._AC_SY300_SX300_QL70_ML2_.jpg", "ÉlectroKin"),
    ("kindle.jpg", "https://m.media-amazon.com/images/I/61xh6e4ZTQL._AC_SY300_SX300_QL70_ML2_.jpg", "ÉlectroKin"),
    ("disque_dur.jpg", "https://m.media-amazon.com/images/I/61XbnUE8ipL._AC_SX679_.jpg", "ÉlectroKin"),
    ("moniteur_samsung.jpg", "https://m.media-amazon.com/images/I/61nZKQnhu3L._AC_SX522_.jpg", "ÉlectroKin"),
    ("echo_show.jpg", "https://m.media-amazon.com/images/I/71htodioUcL._AC_SY300_SX300_QL70_ML2_.jpg", "ÉlectroKin"),

    ("tshirt_carhartt.jpg", "https://m.media-amazon.com/images/I/71SRrNMlH0L._AC_SY879_.jpg", "ModeAfrique"),
    ("montre_intelligente.jpg", "https://m.media-amazon.com/images/I/619lzWYApAL._AC_SY300_SX300_QL70_ML2_.jpg", "ModeAfrique"),
    ("crocs.jpg", "https://m.media-amazon.com/images/I/61SuPkDGYfL._AC_SY695_.jpg", "ModeAfrique"),
    ("soutien_gorge.jpg", "https://m.media-amazon.com/images/I/61YZ2fRtowL._AC_SX679_.jpg", "ModeAfrique"),

    ("panneau_solaire_usb.jpg", "https://m.media-amazon.com/images/I/81jUWJQS4qL._AC_SX679_.jpg", "SolarDRC"),
    ("lampes_solaires.jpg", "https://m.media-amazon.com/images/I/71fofutDdgL._AC_SX679_.jpg", "SolarDRC"),

    ("perceuse.jpg", "https://m.media-amazon.com/images/I/810mhyjBI7L._AC_SY300_SX300_QL70_ML2_.jpg", "Outillage"),
    ("creatine.jpg", "https://m.media-amazon.com/images/I/61XNvfO+stL._AC_SX679_.jpg", "Santé"),

    ("riz_basmati.jpg", "https://m.media-amazon.com/images/I/81ov+4Y6IJL._AC_SY879_.jpg", "AgriMarché RDC"),
    ("melange_riz.jpg", "https://m.media-amazon.com/images/I/814QeFFumpL._AC_SY300_SX300_QL70_ML2_.jpg", "AgriMarché RDC"),
    ("farine_ble.jpg", "https://m.media-amazon.com/images/I/71eBfZnaxpL._AC_SY300_SX300_QL70_ML2_.jpg", "AgriMarché RDC"),
]

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

for filename, url, shop in PRODUCTS:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content)).convert("RGB")

        # Carré 600x600, fond blanc, image centrée (ratio conservé)
        size = 600
        img.thumbnail((size, size))
        bg = Image.new("RGB", (size, size), (255, 255, 255))
        offset = ((size - img.width) // 2, (size - img.height) // 2)
        bg.paste(img, offset)

        out_path = os.path.join(OUT_DIR, filename)
        bg.save(out_path, "JPEG", quality=85)
        print(f"OK  {shop:<16} -> {out_path}")
    except Exception as e:
        print(f"ERR {shop:<16} -> {filename}: {e}")

print("\nTerminé. Pense à faire: git add public/images/products && git commit -m 'Ajout images produits réelles (test)' && git push")