"""Bounded image/document validation before object storage writes."""
import io
import warnings
from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
IMAGE_TYPES = {"JPEG":"image/jpeg", "PNG":"image/png", "WEBP":"image/webp", "GIF":"image/gif"}


async def read_upload(file: UploadFile, allow_pdf: bool = False) -> bytes:
    content_type = (file.content_type or "").split(";", 1)[0].lower()
    allowed = set(IMAGE_TYPES.values()) | ({"application/pdf"} if allow_pdf else set())
    if content_type not in allowed:
        raise HTTPException(status_code=415, detail="Format de fichier non autorisé")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Le fichier dépasse 8 Mo")
    if not data:
        raise HTTPException(status_code=422, detail="Fichier vide")
    if content_type == "application/pdf":
        if not data.startswith(b"%PDF-"):
            raise HTTPException(status_code=422, detail="Document PDF invalide")
        return data
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(status_code=413, detail="Dimensions de l’image trop grandes")
                if IMAGE_TYPES.get(image.format) != content_type:
                    raise HTTPException(status_code=415, detail="Le format annoncé ne correspond pas au fichier")
                image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(status_code=422, detail="Image invalide")
    return data
