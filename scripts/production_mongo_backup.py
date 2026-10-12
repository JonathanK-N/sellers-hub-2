"""Approved standalone backup and isolated restore. Author: Jonathan Kakesa (JonathanK-N).

Secret settings are supplied on stdin. Production writes are paused only after
explicit approval. Archives are encrypted in memory before reaching disk.
"""
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import threading
import time
from urllib.parse import urlparse, quote
from bson import BSON
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pymongo import MongoClient

AAD = b"AfriMarket standalone recovery v1"


def protect(path):
    if os.name == "nt":
        account = subprocess.check_output(["whoami"], text=True).strip()
        subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r", account + ":(OI)(CI)F" if path.is_dir() else account + ":F"], check=True, capture_output=True)
    else:
        path.chmod(0o700 if path.is_dir() else 0o600)


def fingerprint(db):
    result = {}
    for name in sorted(db.list_collection_names()):
        digest = hashlib.sha256()
        count = 0
        for document in db[name].find({}).sort("_id", 1).batch_size(100):
            encoded = BSON.encode(document)
            digest.update(len(encoded).to_bytes(8, "big"))
            digest.update(encoded)
            count += 1
        indexes = sorted([dict(row) for row in db[name].list_indexes()], key=lambda row: row["name"])
        result[name] = {"documents": count, "sha256": digest.hexdigest(),
                        "indexes_sha256": hashlib.sha256(json.dumps(indexes, sort_keys=True, default=str).encode()).hexdigest(),
                        "index_count": len(indexes)}
    return result


def run(settings):
    parsed = urlparse(settings["uri"])
    host = parsed.hostname
    synthetic = host in {"127.0.0.1", "localhost"} and settings["database"].startswith("afrimarket_test_")
    if not synthetic and (host != "zephyr.proxy.rlwy.net" or parsed.port != 35998 or settings.get("approved_write_pause") is not True):
        raise RuntimeError("Production target and explicit write-pause approval required")
    private = Path(settings["private_output"]).resolve()
    if private.exists():
        raise RuntimeError("Fresh private output directory required")
    private.mkdir(parents=True)
    protect(private)
    port = 27019
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", port)) == 0:
            raise RuntimeError("Isolated restore port is already occupied")
    source = MongoClient(settings["uri"], serverSelectionTimeoutMS=15000, socketTimeoutMS=30000)
    target = None
    process = None
    timer = None
    locked = False
    lock_guard = threading.Lock()
    expired = threading.Event()
    lock_start = None
    lock_seconds = None
    config_paths = []

    def unlock():
        nonlocal locked, lock_seconds
        with lock_guard:
            if locked:
                result = source.admin.command({"fsyncUnlock": 1})
                if result.get("lockCount") != 0:
                    raise RuntimeError("Source remains locked after releasing owned lock")
                locked = False
                lock_seconds = time.monotonic() - lock_start

    def watchdog():
        expired.set()
        try:
            unlock()
        except Exception:
            # The final cleanup retries; no credential-bearing exception text.
            pass

    def config(name, uri):
        file = private / name
        file.write_text(json.dumps({"uri": uri}), encoding="utf-8")
        protect(file)
        config_paths.append(file)
        return str(file)

    try:
        if source.admin.command("hello").get("setName"):
            raise RuntimeError("This procedure targets standalone deployments only")
        if source.admin.command({"currentOp": 1}).get("fsyncLock"):
            raise RuntimeError("Source already locked; no ownership of existing lock")
        db = source[settings["database"]]
        stats = db.command("dbStats")
        if stats.get("dataSize", 0) > 100 * 1024 * 1024:
            raise RuntimeError("Database exceeds reviewed in-memory backup size limit")
        # Prepare a protected authenticated restore server BEFORE pausing source writes.
        data = private / "isolated-data"
        data.mkdir()
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        process = subprocess.Popen([settings["mongod"], "--auth", "--bind_ip=127.0.0.1", "--port=" + str(port), "--dbpath=" + str(data), "--logpath=" + str(private / "restore-mongod.log"), "--wiredTigerCacheSizeGB=0.25"], creationflags=flags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        initial = MongoClient("mongodb://127.0.0.1:" + str(port), serverSelectionTimeoutMS=1000)
        deadline = time.monotonic() + 45
        while True:
            try:
                initial.admin.command("ping")
                break
            except Exception:
                if time.monotonic() > deadline:
                    raise RuntimeError("Isolated server unavailable")
                time.sleep(0.5)
        password = secrets.token_urlsafe(40)
        initial.admin.command("createUser", "restore_owner", pwd=password, roles=[{"role": "root", "db": "admin"}])
        initial.close()
        (private / "restore-owner.key").write_text(password, encoding="utf-8")
        protect(private / "restore-owner.key")
        target_uri = "mongodb://restore_owner:" + quote(password, safe="") + "@127.0.0.1:" + str(port) + "/?authSource=admin"
        target = MongoClient(target_uri, serverSelectionTimeoutMS=5000)
        if set(target.list_database_names()) - {"admin", "config", "local"}:
            raise RuntimeError("Restore target not empty")
        dump_config = config("dump-credentials.json", settings["uri"])
        restore_config = config("restore-credentials.json", target_uri)
        key = AESGCM.generate_key(bit_length=256)
        key_file = private / "backup-recovery.key"
        key_file.write_bytes(key)
        protect(key_file)
        lock_start = time.monotonic()
        # A timed-out lock response may still have locked the server. Cleanup
        # must attempt release even when the response was not received.
        locked = True
        timer = threading.Timer(180, watchdog)
        timer.daemon = True
        timer.start()
        lock_result = source.admin.command({"fsync": 1, "lock": True})
        if lock_result.get("lockCount") != 1:
            raise RuntimeError("Unexpected lock ownership count")
        before = fingerprint(db)
        start = time.monotonic()
        dump = subprocess.run([settings["mongodump"], "--config=" + dump_config, "--db=" + settings["database"], "--archive", "--gzip"], capture_output=True, timeout=120)
        if dump.returncode or expired.is_set():
            raise RuntimeError("Coherent dump failed or write-pause deadline expired")
        dump_seconds = time.monotonic() - start
        unlock()
        timer.cancel()
        nonce = os.urandom(12)
        encrypted = nonce + AESGCM(key).encrypt(nonce, dump.stdout, AAD)
        archive = private / "production.archive.gz.aesgcm"
        archive.write_bytes(encrypted)
        protect(archive)
        recovered = AESGCM(key_file.read_bytes()).decrypt(encrypted[:12], encrypted[12:], AAD)
        if recovered != dump.stdout:
            raise RuntimeError("Authenticated decryption mismatch")
        start = time.monotonic()
        restored = subprocess.run([settings["mongorestore"], "--config=" + restore_config, "--archive", "--gzip", "--stopOnError"], input=recovered, capture_output=True, timeout=180)
        if restored.returncode:
            raise RuntimeError("Isolated restore failed")
        restore_seconds = time.monotonic() - start
        after = fingerprint(target[settings["database"]])
        if before != after:
            raise RuntimeError("Document, identifier or index integrity mismatch")
        report = {"status": "PASS", "scope": "synthetic standalone" if synthetic else "production business database, coherent standalone dump and authenticated loopback restore", "encryption": "AES-256-GCM; plaintext archive only in process memory", "encrypted_sha256": hashlib.sha256(encrypted).hexdigest(), "encrypted_bytes": len(encrypted), "write_pause_seconds": lock_seconds, "dump_seconds": dump_seconds, "restore_seconds": restore_seconds, "collections": after, "source_unlock_confirmed": not locked, "database_RPO": "snapshot at write pause", "application_RTO": "not measured"}
        (private / "backup-proof.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report
    finally:
        if timer:
            timer.cancel()
        try:
            unlock()
        finally:
            for file in config_paths:
                file.unlink(missing_ok=True)
            if target:
                target.close()
            if process:
                process.terminate()
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=15)
            source.close()


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.load(sys.stdin))))
    except Exception as error:
        print(json.dumps({"status": "FAIL", "error_class": type(error).__name__}))
        sys.exit(1)
