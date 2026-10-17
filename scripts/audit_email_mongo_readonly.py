"""Read-only email/delivery readiness. Author: Jonathan Kakesa."""
import json
import sys
from pymongo import MongoClient


def main():
    settings = json.load(sys.stdin)
    client = MongoClient(settings["uri"], serverSelectionTimeoutMS=10000,
                         connectTimeoutMS=10000, socketTimeoutMS=15000,
                         appname="AfriMarketEmailReadOnlyAudit")
    try:
        hello = client.admin.command("hello")
        db = client[settings["database"]]
        profiles = db.deliverers
        grouped = list(profiles.aggregate([
            {"$group": {"_id": {"affiliation": {"$ifNull": ["$affiliation", "missing"]},
                                 "active": {"$eq": ["$is_active", True]}}, "count": {"$sum": 1}}}
        ], maxTimeMS=10000))
        dangling = list(profiles.aggregate([
            {"$match": {"affiliation": "shop"}},
            {"$lookup": {"from": "sellers", "localField": "seller_id", "foreignField": "id", "as": "shop"}},
            {"$match": {"shop": {"$size": 0}}}, {"$count": "count"}
        ], maxTimeMS=10000))
        duplicates = list(profiles.aggregate([
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
            {"$match": {"count": {"$gt": 1}}}, {"$count": "count"}
        ], maxTimeMS=10000))
        missing = list(db.users.aggregate([
            {"$match": {"role": "deliverer"}},
            {"$lookup": {"from": "deliverers", "localField": "id", "foreignField": "user_id", "as": "profiles"}},
            {"$match": {"profiles": {"$size": 0}}}, {"$count": "count"}
        ], maxTimeMS=10000))
        report = {"read_only": True, "document_values_disclosed": False,
            "replica_set": bool(hello.get("setName")),
            "mongos": hello.get("msg") == "isdbgrid",
            "transactions_supported": bool(hello.get("setName") or hello.get("msg") == "isdbgrid"),
            "deliverer_profiles": profiles.count_documents({}, maxTimeMS=10000),
            "affiliations": [{"affiliation": row["_id"]["affiliation"], "active": row["_id"]["active"], "count": row["count"]} for row in grouped],
            "dangling_shop_profiles": dangling[0]["count"] if dangling else 0,
            "duplicate_user_profiles": duplicates[0]["count"] if duplicates else 0,
            "deliverer_accounts_without_profile": missing[0]["count"] if missing else 0,
            "email_outbox_count": db.email_outbox.count_documents({}, maxTimeMS=10000),
            "email_tokens_count": db.email_tokens.count_documents({}, maxTimeMS=10000)}
        print(json.dumps(report))
        return 0
    except Exception as error:
        print(json.dumps({"status": "unavailable", "error_class": type(error).__name__,
                          "error_code": getattr(error, "code", None)}))
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
