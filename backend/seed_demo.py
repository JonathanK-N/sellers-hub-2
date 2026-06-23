"""Demo seed — désactivé en production."""
import logging
logger = logging.getLogger(__name__)


async def seed_demo():
    logger.info("seed_demo désactivé en production")
    return {"skipped": True}


async def _refresh_product_images(db):
    pass
