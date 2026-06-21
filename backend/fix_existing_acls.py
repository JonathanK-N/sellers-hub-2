# -*- coding: utf-8 -*-
"""One-off fix: apply public-read ACL to all existing public files in S3.

Needed because objects uploaded before the ACL=public-read fix in
s3_service.py defaulted to private ACL, causing AccessDenied on read
even though the bucket policy allows public GetObject.

Only touches files NOT marked is_private (KYC docs are correctly left
untouched — they must stay private)."""
import asyncio
import boto3
import os
from botocore.exceptions import ClientError

from db import init_db, get_db

BUCKET_PUBLIC = os.environ.get("AWS_BUCKET_PUBLIC", "afrimarket")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")


def _client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


async def fix():
    init_db()
    db = get_db()
    client = _client()

    cursor = db.files.find(
        {"$or": [{"is_private": {"$exists": False}}, {"is_private": False}]},
        {"id": 1, "storage_path": 1},
    )
    files = await cursor.to_list(1000)
    print(f"{len(files)} fichiers publics a corriger.")

    success, failed = 0, []
    for f in files:
        key = f["storage_path"]
        try:
            client.put_object_acl(Bucket=BUCKET_PUBLIC, Key=key, ACL="public-read")
            print(f"  OK - {key}")
            success += 1
        except ClientError as e:
            print(f"  ERREUR - {key} - {e}")
            failed.append(key)

    print(f"\n{success}/{len(files)} corriges, {len(failed)} echecs.")
    if failed:
        print("Echecs:", failed)


asyncio.run(fix())
