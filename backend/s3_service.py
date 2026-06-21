"""AWS S3 storage service for AfriMarket.

Replaces storage.py (third-party emergentagent.com proxy). Two buckets:
- AWS_BUCKET_PUBLIC ("afrimarket"): product photos, shop logos/banners,
  user avatars. Publicly readable — returns direct S3 URLs.
- AWS_BUCKET_KYC ("afrimarket-kyc-private"): KYC documents (ID cards,
  selfies, address proofs). Block Public Access enabled — only ever
  accessed via short-lived presigned URLs, never a direct public URL. testahah
"""
import os
import logging
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BUCKET_PUBLIC = os.environ.get("AWS_BUCKET_PUBLIC", "afrimarket")
BUCKET_KYC = os.environ.get("AWS_BUCKET_KYC", "afrimarket-kyc-private")


@lru_cache(maxsize=1)
def _client():
    """Lazily build and cache the boto3 S3 client. Credentials come from
    AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars (set on Railway)."""
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


def s3_configured() -> bool:
    return bool(os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"))


def upload_public(path: str, data: bytes, content_type: str) -> dict:
    """Upload to the public bucket. Returns {"path": s3_key, "url": direct_public_url, "size": n}."""
    if not s3_configured():
        raise RuntimeError("AWS credentials not configured")
    try:
        _client().put_object(
            Bucket=BUCKET_PUBLIC,
            Key=path,
            Body=data,
            ContentType=content_type,
        )
    except (ClientError, NoCredentialsError) as e:
        logger.error(f"S3 public upload failed ({path}): {e}")
        raise RuntimeError(f"Échec du téléversement S3: {e}")
    url = f"https://{BUCKET_PUBLIC}.s3.{AWS_REGION}.amazonaws.com/{path}"
    return {"path": path, "url": url, "size": len(data)}


def upload_private(path: str, data: bytes, content_type: str) -> dict:
    """Upload to the private KYC bucket. Returns {"path": s3_key, "size": n} —
    deliberately no public URL; callers must use generate_presigned_url()."""
    if not s3_configured():
        raise RuntimeError("AWS credentials not configured")
    try:
        _client().put_object(
            Bucket=BUCKET_KYC,
            Key=path,
            Body=data,
            ContentType=content_type,
        )
    except (ClientError, NoCredentialsError) as e:
        logger.error(f"S3 private upload failed ({path}): {e}")
        raise RuntimeError(f"Échec du téléversement S3: {e}")
    return {"path": path, "size": len(data)}


def generate_presigned_url(key: str, expires_in: int = 300, bucket: str = BUCKET_KYC) -> str:
    """Generate a short-lived signed URL for a private object. Default 5 minutes —
    intentionally short since this is only used for one-off admin review."""
    if not s3_configured():
        raise RuntimeError("AWS credentials not configured")
    try:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        logger.error(f"S3 presign failed ({key}): {e}")
        raise RuntimeError(f"Échec de la génération d'URL: {e}")


def get_object_public(path: str) -> tuple[bytes, str]:
    """Fetch raw bytes from the public bucket (fallback path, e.g. server-side
    processing). Most public reads should just use the direct URL instead."""
    try:
        resp = _client().get_object(Bucket=BUCKET_PUBLIC, Key=path)
        return resp["Body"].read(), resp.get("ContentType", "application/octet-stream")
    except ClientError as e:
        logger.error(f"S3 public get failed ({path}): {e}")
        raise RuntimeError(f"Fichier introuvable: {e}")


def delete_object(path: str, private: bool = False) -> None:
    bucket = BUCKET_KYC if private else BUCKET_PUBLIC
    try:
        _client().delete_object(Bucket=bucket, Key=path)
    except ClientError as e:
        logger.warning(f"S3 delete failed ({path}): {e}")
