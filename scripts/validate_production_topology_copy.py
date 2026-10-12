"""Topology rehearsal on a protected offline copy only. Author: Jonathan Kakesa (JonathanK-N)."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
from urllib.parse import quote
from pymongo import MongoClient
from pymongo.errors import AutoReconnect, OperationFailure
from production_mongo_backup import fingerprint, protect


class TopologyError(RuntimeError):
    """Static non-secret diagnostic for the protected rehearsal."""



def run(settings):
    root = Path(settings["private_root"]).resolve()
    source = Path(settings["protected_restore"]).resolve()
    output = Path(settings["private_output"]).resolve()
    if root not in source.parents or not source.name.startswith("production-mongo-"):
        raise TopologyError("Verified protected restore required")
    if root not in output.parents or not output.name.startswith("production-topology-") or output.exists():
        raise TopologyError("Fresh private topology directory required")
    backup = json.loads((source / "backup-proof.json").read_text())
    if backup.get("status") != "PASS":
        raise TopologyError("Backup proof must pass")
    for port in (27019, 27119, 27219):
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise TopologyError("Protected server port occupied")
    if (source / "isolated-data" / "mongod.lock").stat().st_size:
        raise TopologyError("Source restore is not cleanly stopped")
    output.mkdir()
    protect(output)
    data = output / "data"
    shutil.copytree(source / "isolated-data", data)
    password = (source / "restore-owner.key").read_text()
    keyfile = output / "replica-set.key"
    keyfile.write_bytes(base64.b64encode(secrets.token_bytes(756)))
    protect(keyfile)
    if os.name != "nt":
        keyfile.chmod(0o400)
    owner_uri = "mongodb://restore_owner:" + quote(password, safe="") + "@127.0.0.1:27219/?authSource=admin&directConnection=true"
    process = None
    client = None
    phases = []

    def start(replica):
        nonlocal process, client
        args = [settings["mongod"], "--bind_ip=127.0.0.1", "--port=27219", "--dbpath=" + str(data),
                "--logpath=" + str(output / "mongod.log"), "--logappend", "--wiredTigerCacheSizeGB=0.25"]
        if replica:
            args += ["--replSet=afrimarket-production-copy-rs", "--keyFile=" + str(keyfile), "--oplogSize=128"]
        args += ["--auth"]
        process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        client = MongoClient(owner_uri, serverSelectionTimeoutMS=1000)
        deadline = time.monotonic() + 45
        while True:
            try:
                client.admin.command("ping")
                return
            except Exception:
                if process.poll() is not None or time.monotonic() > deadline:
                    raise TopologyError("Protected topology server unavailable")
                time.sleep(0.5)

    def stop():
        nonlocal process, client
        if process is None:
            return
        try:
            if client is not None and process.poll() is None:
                try:
                    client.admin.command({"shutdown": 1, "force": False})
                except AutoReconnect:
                    pass
            process.wait(timeout=30)
        finally:
            if client is not None:
                client.close()
            if process.poll() is None:
                process.kill()
                process.wait(timeout=15)
                raise TopologyError("Clean shutdown failed")
            process = None
            client = None

    def compare(phase, baseline):
        observed = fingerprint(client[settings["database"]])
        if observed != baseline:
            raise TopologyError("Protected document or index integrity mismatch")
        phases.append({"phase": phase, "documents_identical": True, "indexes_identical": True})

    try:
        start(False)
        baseline = fingerprint(client[settings["database"]])
        for name, original in backup["collections"].items():
            current = baseline.get(name)
            if current is None or current["documents"] != original["documents"] or current["sha256"] != original["sha256"]:
                raise TopologyError("Original restored business documents changed")
        phases.append({"phase": "standalone baseline", "original_collections": len(backup["collections"]), "original_documents_identical": True})
        stop()
        start(True)
        client.admin.command({"replSetInitiate": {"_id": "afrimarket-production-copy-rs", "members": [{"_id": 0, "host": "localhost:27219"}]}})
        deadline = time.monotonic() + 45
        while not client.admin.command("hello").get("isWritablePrimary"):
            if time.monotonic() > deadline:
                raise TopologyError("Protected PRIMARY unavailable")
            time.sleep(0.5)
        compare("authenticated replica-set conversion", baseline)
        app_password = secrets.token_urlsafe(40)
        database = client[settings["database"]]
        database.command("createUser", "topology_copy_app", pwd=app_password, roles=[{"role": "readWrite", "db": settings["database"]}])
        app_uri = "mongodb://topology_copy_app:" + quote(app_password, safe="") + "@localhost:27219/" + quote(settings["database"], safe="") + "?authSource=" + quote(settings["database"], safe="") + "&replicaSet=afrimarket-production-copy-rs"
        with MongoClient(app_uri, serverSelectionTimeoutMS=5000) as app:
            app_db = app[settings["database"]]
            fixture = "_afrimarket_topology_rehearsal_only"
            if fixture in app_db.list_collection_names():
                raise TopologyError("Fixture namespace already exists")
            app_db.create_collection(fixture)
            with app.start_session() as session:
                session.start_transaction()
                app_db[fixture].insert_one({"_id": "TEST-transaction"}, session=session)
                session.abort_transaction()
            if app_db[fixture].count_documents({}) != 0:
                raise TopologyError("Transaction abort did not preserve empty fixture")
            with app.start_session() as session:
                with session.start_transaction():
                    app_db[fixture].insert_one({"_id": "TEST-transaction"}, session=session)
            if app_db[fixture].count_documents({}) != 1:
                raise TopologyError("Transaction commit failed")
            app_db.drop_collection(fixture)
            try:
                app.admin.command({"usersInfo": 1})
                raise TopologyError("Application has excessive admin rights")
            except OperationFailure as error:
                if error.code != 13:
                    raise
        with MongoClient("mongodb://127.0.0.1:27219/?directConnection=true", serverSelectionTimeoutMS=1000) as anonymous:
            try:
                anonymous[settings["database"]].list_collection_names()
                raise TopologyError("Anonymous business access permitted")
            except OperationFailure as error:
                if error.code != 13:
                    raise
        compare("limited application transactions and anonymous denial", baseline)
        stop()
        start(True)
        deadline = time.monotonic() + 45
        while not client.admin.command("hello").get("isWritablePrimary"):
            if time.monotonic() > deadline:
                raise TopologyError("PRIMARY did not survive restart")
            time.sleep(0.5)
        compare("persistent replica-set restart", baseline)
        stop()
        start(False)
        if client.admin.command("hello").get("setName"):
            raise TopologyError("Standalone rollback not effective")
        compare("standalone topology rollback on copy only", baseline)
        return {"status": "PASS", "scope": "protected offline restore copy on loopback only; no production conversion", "mongodb_version": client.server_info()["version"], "phases": phases, "original_business_collections": len(backup["collections"]), "collections_with_additive_indexes": len(baseline), "production_downtime": "not measured", "application_code_rollback": "not certified", "encrypted_backup_unchanged": hashlib.sha256((source / "production.archive.gz.aesgcm").read_bytes()).hexdigest() == backup["encrypted_sha256"]}
    finally:
        stop()


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.load(sys.stdin))))
    except Exception as error:
        print(json.dumps({"status": "FAIL", "error_class": type(error).__name__, "diagnostic": str(error) if isinstance(error, TopologyError) else "Protected topology rehearsal failed; details withheld"}))
        sys.exit(1)
