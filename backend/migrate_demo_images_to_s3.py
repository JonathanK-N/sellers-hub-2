"""One-off script: migrate demo images from the public GitHub assets repo
(afrimarket-assets) to the AWS S3 public bucket.

Run this ONCE, with real AWS credentials available in the environment
(Railway shell, or locally with a .env file). After running, seed_demo.py
is updated in place to reference S3 URLs instead of GitHub raw URLs.

Usage:
    python migrate_demo_images_to_s3.py
"""
import os
import sys
import logging
import requests

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
            resp = requests.get(src_url, timeout=30)
            resp.raise_for_status()
        except Exception as e:
            logger.warning(f"  ✗ download failed: {filename} ({e})")
            failed.append(filename)
            continue

        s3_path = f"{S3_PREFIX}/{filename}"
        try:
            result = upload_public(s3_path, resp.content, "image/jpeg")
        except Exception as e:
            logger.warning(f"  ✗ S3 upload failed: {filename} ({e})")
            failed.append(filename)
            continue

        key = filename.rsplit(".", 1)[0]  # strip extension to match img() helper
        url_map[key] = result["url"]
        success += 1
        logger.info(f"  ✓ {filename} → {result['url']}")

    logger.info(f"\nDone: {success}/{len(IMAGE_FILENAMES)} migrated, {len(failed)} failed")
    if failed:
        logger.warning(f"Failed files: {failed}")

    # Write the URL map to a JSON file for the next step (updating seed_demo.py)
    import json
    out_path = os.path.join(os.path.dirname(__file__), "demo_images_s3_map.json")
    with open(out_path, "w") as f:
        json.dump(url_map, f, indent=2)
    logger.info(f"URL map written to {out_path}")
    logger.info("Next: update seed_demo.py's img() function to use this map, or re-run seed with SEED_DEMO=1 after redeploy.")


if __name__ == "__main__":
    migrate()
