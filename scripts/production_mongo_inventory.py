"""Read-only schema inventory. Author: Jonathan Kakesa (JonathanK-N).

Connection settings arrive on stdin, never in arguments or reports. No document
values, identifiers or credentials are emitted. This is not a backup.
"""
import json
import sys
from datetime import datetime, timezone
from pymongo import MongoClient


def main():
    settings = json.load(sys.stdin)
    client = MongoClient(settings["uri"], serverSelectionTimeoutMS=15000,
                         connectTimeoutMS=15000, socketTimeoutMS=30000,
                         appname="AfriMarketReadOnlyInventory")
    try:
        hello = client.admin.command("hello")
        db = client[settings["database"]]
        stats = db.command("dbStats")
        report = {"scope": "production read-only metadata, no document values",
                  "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                  "replica_set": bool(hello.get("setName")),
                  "writable_primary": bool(hello.get("isWritablePrimary")),
                  "data_bytes": stats.get("dataSize"),
                  "storage_bytes": stats.get("storageSize"),
                  "collections": []}
        for name in sorted(db.list_collection_names()):
            collection = db[name]
            indexes = [{"name": index["name"], "key": list(index["key"].items()),
                        "unique": bool(index.get("unique")),
                        "sparse": bool(index.get("sparse")),
                        "ttl_seconds": index.get("expireAfterSeconds")}
                       for index in collection.list_indexes()]
            fields = list(collection.aggregate([
                {"$limit": 100},
                {"$project": {"fields": {"$objectToArray": "$$ROOT"}}},
                {"$unwind": "$fields"},
                {"$group": {"_id": {"field": "$fields.k", "type": {"$type": "$fields.v"}}, "sample_count": {"$sum": 1}}},
                {"$sort": {"_id.field": 1, "_id.type": 1}},
            ], maxTimeMS=15000))
            report["collections"].append({"name": name,
                "count": collection.count_documents({}, maxTimeMS=15000),
                "indexes": indexes, "sample_fields": fields,
                "sample_limit": 100})
        print(json.dumps(report, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"status": "FAIL", "error_class": type(error).__name__,
                          "error_code": getattr(error, "code", None)}))
        return 1
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
