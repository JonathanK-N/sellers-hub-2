import asyncio
import io
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers
from PIL import Image
from uploads import read_upload, MAX_UPLOAD_BYTES


def file(data, mime):
    return UploadFile(io.BytesIO(data), filename="synthetic", headers=Headers({"content-type":mime}))


@pytest.mark.parametrize("data,mime,expected", [(b"<script>test</script>","image/png",422),(b"<svg/>","image/svg+xml",415),(b"", "image/jpeg",422),(b"not a pdf","application/pdf",415)])
def test_invalid_public_upload_is_rejected(data, mime, expected):
    with pytest.raises(HTTPException) as error:
        asyncio.run(read_upload(file(data,mime)))
    assert error.value.status_code == expected


def test_oversized_upload_reads_only_bounded_prefix():
    upload = file(b"", "image/png")
    upload.read = AsyncMock(return_value=b"x" * (MAX_UPLOAD_BYTES + 1))
    with pytest.raises(HTTPException) as error:
        asyncio.run(read_upload(upload))
    assert error.value.status_code == 413
    upload.read.assert_awaited_once_with(MAX_UPLOAD_BYTES + 1)


def test_valid_image_and_private_pdf_are_allowed():
    data = io.BytesIO()
    Image.new("RGB",(1,1)).save(data,format="PNG")
    assert asyncio.run(read_upload(file(data.getvalue(),"image/png"))) == data.getvalue()
    assert asyncio.run(read_upload(file(b"%PDF-1.7\nsynthetic", "application/pdf"), allow_pdf=True)).startswith(b"%PDF-")
