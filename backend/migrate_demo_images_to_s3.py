"""One-off script: migrate demo images from the public GitHub assets repo
(afrimarket-assets) to the AWS S3 public bucket.

Uses urllib (Python stdlib) instead of requests, to avoid depending on a
package that may not be installed in the production runtime image.

Run this ONCE, with real AWS credentials available in the environment
(Railway console, or locally with a .env file). After running, seed_demo.py
is updated separately (img() already points at S3) — this script just
populates the bucket with the actual files.

Usage:
    python migrate_demo_images_to_s3.py
"""
import os
import sys
import json
import logging
import urllib.request
import urllib.error
from urllib.parse import urlsplit

sys.path.insert(0, os.path.dirname(__file__))
from s3_service import upload_public, s3_configured  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)

GITHUB_ASSETS_BASE = "https://raw.githubusercontent.com/JonathanK-N/afrimarket-assets/main/products"

IMAGE_FILENAMES = [
    "assiettes.jpg", "camera_securite.jpg", "casseroles.jpg", "chargeur.jpg",
    "creatine.jpg", "crocs.jpg", "disque_dur.jpg", "echo_dot.jpg", "echo_show.jpg",
    "ecouteurs.jpg", "farine.jpg", "farine_ble.jpg", "haricots.jpg", "huile_palme.jpg",
    "ipad.jpg", "kindle.jpg", "kit_solaire.jpg", "lampe.jpg", "lampes_solaires.jpg",
    "logo_agri.jpg", "logo_electro.jpg", "logo_maison.jpg", "logo_mode.jpg",
    "logo_solar.jpg", "melange_riz.jpg", "miroir.jpg", "moniteur_samsung.jpg",
    "montre_intelligente.jpg", "pagne.jpg", "panneau.jpg", "panneau_solaire_usb.jpg",
    "perceuse.jpg", "powerbank.jpg", "riz.jpg", "riz_basmati.jpg", "robe.jpg",
    "sac.jpg", "smartphone.jpg", "soutien_gorge.jpg", "tshirt_carhartt.jpg",
    "tv_tcl.jpg", "ventilateur.jpg",
]

S3_PREFIX = "afrimarket/demo-products"


def _download(url: str) -> bytes:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != "raw.githubusercontent.com":
        raise ValueError("Only the configured HTTPS asset host is permitted")
    req = urllib.request.Request(url, headers={"User-Agent": "afrimarket-migration/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:  # nosec B310: HTTPS and host checked above; fixed public asset URLs.
        return resp.read()


def migrate():
    if not s3_configured():
        logger.error("AWS credentials not found in environment. Aborting.")
        logger.error("Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_PUBLIC")
        sys.exit(1)

    url_map = {}
    success, failed = 0, []

    for filename in IMAGE_FILENAMES:
        src_url = f"{GITHUB_ASSETS_BASE}/{filename}"
        try:
            data = _download(src_url)
        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            logger.warning(f"  ✗ download failed: {filename} ({e})")
            failed.append(filename)
            continue

        s3_path = f"{S3_PREFIX}/{filename}"
        try:
            result = upload_public(s3_path, data, "image/jpeg")
        except Exception as e:
            logger.warning(f"  ✗ S3 upload failed: {filename} ({e})")
            failed.append(filename)
            continue

        key = filename.rsplit(".", 1)[0]
        url_map[key] = result["url"]
        success += 1
        logger.info(f"  ✓ {filename} → {result['url']}")

    logger.info(f"\nDone: {success}/{len(IMAGE_FILENAMES)} migrated, {len(failed)} failed")
    if failed:
        logger.warning(f"Failed files: {failed}")

    out_path = os.path.join(os.path.dirname(__file__), "demo_images_s3_map.json")
    with open(out_path, "w") as f:
        json.dump(url_map, f, indent=2)
    logger.info(f"URL map written to {out_path}")


if __name__ == "__main__":
    migrate()
