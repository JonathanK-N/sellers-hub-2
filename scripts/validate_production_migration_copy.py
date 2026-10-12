"""Additive index rehearsal on protected restore only. Author: Jonathan Kakesa (JonathanK-N)."""
import asyncio
import importlib.util
import json
import logging
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.parse import quote
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient


def main(settings):
    private = Path(settings["private_output"]).resolve()
    root = Path(settings["private_root"]).resolve()
    if root not in private.parents or not private.name.startswith("production-mongo-"):
        raise RuntimeError("Protected production restore directory required")
    if not (private / "backup-proof.json").is_file() or not (private / "isolated-data").is_dir():
        raise RuntimeError("Verified restore required")
    proof = json.loads((private / "backup-proof.json").read_text())
    if proof.get("status") != "PASS":
        raise RuntimeError("Restore proof not PASS")
    port = 27119
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", port)) == 0:
            raise RuntimeError("Rehearsal port already occupied")
    password = (private / "restore-owner.key").read_text()
    uri = "mongodb://restore_owner:" + quote(password, safe="") + "@127.0.0.1:" + str(port) + "/?authSource=admin"
    flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    process = subprocess.Popen([settings["mongod"], "--auth", "--bind_ip=127.0.0.1", "--port=" + str(port), "--dbpath=" + str(private / "isolated-data"), "--logpath=" + str(private / "migration-mongod.log"), "--wiredTigerCacheSizeGB=0.25"], creationflags=flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    client = MongoClient(uri, serverSelectionTimeoutMS=1000)
    try:
        deadline = time.monotonic() + 45
        while True:
            try:
                client.admin.command("ping")
                break
            except Exception:
                if time.monotonic() > deadline:
                    raise RuntimeError("Protected rehearsal server unavailable")
                time.sleep(0.5)
        backup_script = Path(__file__).with_name("production_mongo_backup.py")
        spec = importlib.util.spec_from_file_location("protected_backup", backup_script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        db = client[settings["database"]]
        before = module.fingerprint(db)
        if before != proof["collections"]:
            raise RuntimeError("Restore changed before migration rehearsal")
        logging.disable(logging.CRITICAL)
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
        import db as database_module
        from seed_data import create_indexes
        async def migrate():
            motor = AsyncIOMotorClient(uri)
            original = database_module._db
            database_module._db = motor[settings["database"]]
            try:
                await create_indexes()
            finally:
                database_module._db = original
                motor.close()
        asyncio.run(migrate())
        after = module.fingerprint(db)
        for name, original in before.items():
            if after[name]["sha256"] != original["sha256"] or after[name]["documents"] != original["documents"]:
                raise RuntimeError("Existing document or identifier changed")
        for name in set(after) - set(before):
            if after[name]["documents"] != 0:
                raise RuntimeError("New migration collection contains unexpected documents")
        required = {"transactions": "order_id_1", "disputes": "order_id_1", "messages": "conversation_id_1_created_at_-1_id_-1", "message_rate_limits": "expires_at_1", "sellers": "location_2dsphere"}
        for name, index in required.items():
            if index not in db[name].index_information():
                raise RuntimeError("Required additive index absent")
        return {"status": "PASS", "scope": "protected authenticated loopback restore only; no production migration", "existing_collections": len(before), "existing_documents_preserved": True, "identifiers_preserved": True, "added_collections": sorted(set(after) - set(before)), "indexes_before": {name: row["index_count"] for name, row in before.items()}, "indexes_after": {name: row["index_count"] for name, row in after.items()}, "seed_executed": False, "production_mutated": False}
    finally:
        client.close()
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=15)


if __name__ == "__main__":
    try:
        print(json.dumps(main(json.load(sys.stdin))))
    except Exception as error:
        print(json.dumps({"status": "FAIL", "error_class": type(error).__name__}))
        sys.exit(1)
