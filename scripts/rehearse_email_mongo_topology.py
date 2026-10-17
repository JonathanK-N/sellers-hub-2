"""Synthetic loopback conversion/restore rehearsal. Author: Jonathan Kakesa.

No external URI is accepted. Fresh private directories and free local ports only.
Settings (tool paths/private root) arrive on stdin; secrets never leave this process.
"""
import base64
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
from urllib.parse import quote

from cryptography.fernet import Fernet
from pymongo import MongoClient
from pymongo.errors import AutoReconnect, ConnectionFailure
from production_mongo_backup import fingerprint, protect


def run(settings):
    private_root = Path(settings["private_root"]).resolve(strict=True)
    private = private_root / ("email-topology-synthetic-" + secrets.token_hex(6))
    private.mkdir()
    protect(private)
    ports = [27155, 27156]
    for port in ports:
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError("Isolated port occupied")
    password = secrets.token_urlsafe(40)
    keyfile = private / "member.key"
    keyfile.write_text(base64.b64encode(secrets.token_bytes(96)).decode())
    protect(keyfile)
    backup_key = Fernet.generate_key()
    (private / "backup.key").write_bytes(backup_key)
    protect(private / "backup.key")
    processes = []
    clients = []
    dbname = "afrimarket_test_topology"
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

    def start(data, port, replica=False):
        data.mkdir(exist_ok=True)
        command = [settings["mongod"], "--bind_ip=127.0.0.1", "--port=" + str(port),
                   "--dbpath=" + str(data), "--logpath=" + str(private / (data.name + ".log")),
                   "--wiredTigerCacheSizeGB=0.25", "--auth"]
        if replica:
            command += ["--replSet=email-rehearsal", "--keyFile=" + str(keyfile)]
        process = subprocess.Popen(command, creationflags=flags,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        processes.append(process)
        plain = MongoClient("mongodb://127.0.0.1:" + str(port) + "/?directConnection=true", serverSelectionTimeoutMS=1000)
        clients.append(plain)
        deadline = time.monotonic() + 40
        while True:
            try:
                plain.admin.command("ping")
                break
            except Exception:
                if process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("Local rehearsal server unavailable")
                time.sleep(0.2)
        uri = "mongodb://rehearsal_owner:" + quote(password, safe="") + "@127.0.0.1:" + str(port) + "/?authSource=admin&directConnection=true"
        client = MongoClient(uri, serverSelectionTimeoutMS=1000)
        clients.append(client)
        return process, plain, client

    def stop(process, client):
        try:
            client.admin.command({"shutdown": 1, "force": False})
        except (AutoReconnect, ConnectionFailure):
            pass
        process.wait(timeout=20)

    try:
        source, plain, client = start(private / "source", ports[0])
        plain.admin.command("createUser", "rehearsal_owner", pwd=password,
                            roles=[{"role": "root", "db": "admin"}])
        db = client[dbname]
        db.deliverers.insert_many([
            {"_id": "synthetic-network", "is_active": True},
            {"_id": "synthetic-shop", "is_active": True},
            {"_id": "synthetic-unapproved", "is_active": True},
        ])
        db.sellers.insert_one({"_id": "synthetic-shop-a"})
        db.deliverers.create_index("is_active")
        before = fingerprint(db)
        # The only writer is this process, stopped at this boundary: coherent fixture dump.
        tool_config = private / "tools.yml"
        tool_config.write_text("uri: " + json.dumps("mongodb://127.0.0.1:" + str(ports[0])) +
                               "\npassword: " + json.dumps(password) + "\n")
        protect(tool_config)
        dump = subprocess.run([settings["mongodump"], "--config=" + str(tool_config),
                               "--username=rehearsal_owner", "--authenticationDatabase=admin",
                               "--db=" + dbname, "--archive", "--gzip"],
                              capture_output=True, timeout=45, check=True)
        encrypted = Fernet(backup_key).encrypt(dump.stdout)
        (private / "backup.enc").write_bytes(encrypted)
        stop(source, client)
        source, _, client = start(private / "source", ports[0], replica=True)
        client.admin.command("replSetInitiate", {"_id": "email-rehearsal", "members": [
            {"_id": 0, "host": "127.0.0.1:" + str(ports[0])}]})
        deadline = time.monotonic() + 40
        while not client.admin.command("hello").get("isWritablePrimary"):
            if time.monotonic() > deadline:
                raise RuntimeError("Primary election timeout")
            time.sleep(0.2)
        # Discard bootstrap topology discovery cached before replica set initiation.
        client.close()
        client = MongoClient("mongodb://rehearsal_owner:" + quote(password, safe="") +
                             "@127.0.0.1:" + str(ports[0]) +
                             "/?authSource=admin&directConnection=true", serverSelectionTimeoutMS=5000)
        clients.append(client)
        db = client[dbname]
        assert fingerprint(db) == before, "Conversion changed fixture documents/indexes"
        db.create_collection("transaction_proof")
        with client.start_session() as session:
            session.start_transaction()
            db.transaction_proof.insert_one({"_id": "abort"}, session=session)
            session.abort_transaction()
        assert db.transaction_proof.count_documents({}) == 0
        with client.start_session() as session:
            with session.start_transaction():
                db.transaction_proof.insert_one({"_id": "commit"}, session=session)
        assert db.transaction_proof.count_documents({"_id": "commit"}) == 1
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
        from communications.affiliation import can_assign
        # Explicit decisions for synthetic profiles ONLY; unapproved profile stays untouched.
        decisions = [("synthetic-network", "afrimarket", None),
                     ("synthetic-shop", "shop", "synthetic-shop-a")]
        for identifier, affiliation, seller in decisions:
            changes = {"affiliation": affiliation}
            if seller:
                assert db.sellers.count_documents({"_id": seller}) == 1
                changes["seller_id"] = seller
            result = db.deliverers.update_one({"_id": identifier, "affiliation": {"$exists": False}},
                                               {"$set": changes})
            assert result.modified_count == 1
        network = db.deliverers.find_one({"_id": "synthetic-network"})
        shop = db.deliverers.find_one({"_id": "synthetic-shop"})
        unknown = db.deliverers.find_one({"_id": "synthetic-unapproved"})
        assert can_assign(network, "synthetic-shop-a")
        assert can_assign(shop, "synthetic-shop-a")
        assert not can_assign(shop, "synthetic-shop-b")
        assert not can_assign(unknown, "synthetic-shop-a")
        after = fingerprint(db)
        stop(source, client)
        source, _, client = start(private / "source", ports[0])
        assert fingerprint(client[dbname]) == after, "Topology rollback lost committed writes"
        assert not client.admin.command("hello").get("setName")
        target, initial, restored = start(private / "restore", ports[1])
        initial.admin.command("createUser", "rehearsal_owner", pwd=password,
                              roles=[{"role": "root", "db": "admin"}])
        restore_config = private / "restore-tools.yml"
        restore_config.write_text("uri: " + json.dumps("mongodb://127.0.0.1:" + str(ports[1])) +
                                  "\npassword: " + json.dumps(password) + "\n")
        protect(restore_config)
        subprocess.run([settings["mongorestore"], "--config=" + str(restore_config),
                        "--username=rehearsal_owner", "--authenticationDatabase=admin",
                        "--archive", "--gzip"], input=Fernet(backup_key).decrypt(encrypted),
                       capture_output=True, timeout=45, check=True)
        assert fingerprint(restored[dbname]) == before, "Restored backup differs"
        stop(target, restored)
        stop(source, client)
        return {"status": "PASS", "scope": "fresh authenticated loopback synthetic databases only",
                "conversion_preserves_documents_and_indexes": True,
                "transaction_commit_and_abort": True,
                "encrypted_backup_restored_exactly": True,
                "standalone_rollback_preserves_post_conversion_writes": True,
                "explicit_synthetic_affiliations_checked": True,
                "unapproved_affiliation_unchanged_and_assignment_denied": True,
                "production_read_or_written": False, "existing_directories_used": False}
    finally:
        for client in clients:
            client.close()
        for process in processes:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=20)


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.load(sys.stdin))))
    except Exception as error:
        print(json.dumps({"status": "FAIL", "error_class": type(error).__name__,
                          "check": str(error) if type(error) in (RuntimeError, AssertionError) else "Local operation failed"}))
        sys.exit(1)
