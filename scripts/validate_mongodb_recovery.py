"""Synthetic loopback full dump, AES-GCM encryption and isolated restore.

Author: Jonathan Kakesa (JonathanK-N). This script cannot target production.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import uuid
from bson import json_util
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pymongo import MongoClient


def checksum(data):
    return hashlib.sha256(data).hexdigest()


def fingerprint(db):
    result = {}
    for name in sorted(db.list_collection_names()):
        collection = db[name]
        rows = list(collection.find({}).sort("_id", 1))
        indexes = list(collection.list_indexes())
        result[name] = {"documents": len(rows), "sha256": checksum(json_util.dumps(rows, sort_keys=True).encode()), "indexes": indexes}
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mongod", required=True)
    parser.add_argument("--mongodump", required=True)
    parser.add_argument("--mongorestore", required=True)
    parser.add_argument("--private-output", required=True)
    parser.add_argument("--evidence", required=True)
    args = parser.parse_args()
    private = Path(args.private_output).resolve()
    private.mkdir(parents=True, exist_ok=True)
    data_dir = private / ("restore-data-" + uuid.uuid4().hex)
    data_dir.mkdir()
    source = MongoClient("mongodb://127.0.0.1:27018/?directConnection=true", serverSelectionTimeoutMS=5000)
    if source.admin.command("hello").get("setName") not in {"phase3-test", "test-rs"}:
        raise RuntimeError("Loopback source must be a replica set")
    prefixes = ("afrimarket_test_", "afrimarket_finance_test_", "afrimarket_wallet_test_", "afrimarket_recovery_synthetic_")
    if any(name not in {"admin", "config", "local"} and not name.startswith(prefixes) for name in source.list_database_names()):
        raise RuntimeError("Full dump requires an exclusively synthetic instance")
    name = "afrimarket_recovery_synthetic_" + uuid.uuid4().hex
    db = source[name]
    db.products.create_index("id", unique=True)
    db.orders.create_index("id", unique=True)
    db.products.insert_one({"_id":"TEST-product", "id":"TEST-product", "stock":2})
    db.orders.insert_one({"_id":"TEST-order", "id":"TEST-order", "amount_minor":10000, "escrow_status":"released"})
    db.financial_ledger.insert_one({"_id":"TEST-release", "lines":[{"minor":-10000},{"minor":9300},{"minor":700}]})
    before = fingerprint(db)
    archive = private / "synthetic-full.archive.gz"
    encrypted = private / "synthetic-full.archive.gz.aesgcm"
    key_file = private / "synthetic-backup.key"
    process = None
    target = None
    try:
        start = time.monotonic()
        dump = subprocess.run([args.mongodump,"--host=127.0.0.1","--port=27018","--oplog","--gzip","--archive="+str(archive)], capture_output=True, timeout=180)
        if dump.returncode:
            raise RuntimeError("Synthetic mongodump failed; inspect private log")
        dump_seconds = time.monotonic() - start
        plaintext = archive.read_bytes()
        key = AESGCM.generate_key(bit_length=256)
        nonce = os.urandom(12)
        key_file.write_bytes(key)
        if os.name == "nt":
            account = os.environ["USERDOMAIN"] + "\\" + os.environ["USERNAME"]
            subprocess.run(["icacls",str(key_file),"/inheritance:r","/grant:r",account+":F"],check=True,capture_output=True)
        else:
            key_file.chmod(0o600)
        encrypted.write_bytes(nonce + AESGCM(key).encrypt(nonce, plaintext, b"AfriMarket synthetic recovery"))
        sealed = encrypted.read_bytes()
        recovered = AESGCM(key_file.read_bytes()).decrypt(sealed[:12],sealed[12:],b"AfriMarket synthetic recovery")
        assert checksum(recovered) == checksum(plaintext)
        archive.unlink()
        # Only restore a verified decrypted archive into this freshly created,
        # isolated loopback instance. No --drop, filters or namespace renaming.
        archive.write_bytes(recovered)
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        process = subprocess.Popen([args.mongod,"--bind_ip=127.0.0.1","--port=27019","--dbpath="+str(data_dir),"--logpath="+str(private/"restore-mongod.log")], creationflags=flags)
        target = MongoClient("mongodb://127.0.0.1:27019/",serverSelectionTimeoutMS=1000)
        deadline = time.monotonic()+60
        while True:
            try:
                target.admin.command("ping")
                break
            except Exception:
                if time.monotonic() > deadline:
                    raise RuntimeError("Isolated restore server did not start")
                time.sleep(1)
        if set(target.list_database_names()) - {"admin","config","local"}:
            raise RuntimeError("Restore target is not empty")
        start = time.monotonic()
        restore = subprocess.run([args.mongorestore,"--host=127.0.0.1","--port=27019","--oplogReplay","--gzip","--archive="+str(archive)],capture_output=True,timeout=180)
        if restore.returncode:
            (private/"restore-error.log").write_bytes(restore.stderr)
            raise RuntimeError("Synthetic mongorestore failed; inspect private log")
        restore_seconds = time.monotonic()-start
        after = fingerprint(target[name])
        assert before == after, "Document or index integrity mismatch"
        journal = target[name].financial_ledger.find_one({"_id":"TEST-release"})
        assert sum(line["minor"] for line in journal["lines"]) == 0
        result = {"status":"PASS","scope":"synthetic loopback full replica-set dump and isolated restore; production BLOCKED","mongo_version":source.server_info()["version"],"dump_seconds":dump_seconds,"restore_seconds":restore_seconds,"plaintext_sha256":checksum(plaintext),"encrypted_sha256":checksum(sealed),"encrypted_bytes":len(sealed),"encryption":"AES-256-GCM; key private with restricted ACL","collections":{k:{"documents":v["documents"],"sha256":v["sha256"],"indexes":[x["name"] for x in v["indexes"]]} for k,v in after.items()},"production_RPO":"NOT MEASURED","production_RTO":"NOT MEASURED"}
        Path(args.evidence).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
        print(json.dumps(result))
    finally:
        if archive.exists():
            archive.unlink()
        if target:
            target.close()
        if process:
            process.terminate()
            process.wait(timeout=30)
        source.drop_database(name)
        source.close()


if __name__ == "__main__":
    main()
