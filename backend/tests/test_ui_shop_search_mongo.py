"""Read-only shop-name search. Author: Jonathan Kakesa (JonathanK-N)."""
import asyncio
from routers.products_router import list_products
from test_launch_direct_mongo import isolated


def test_shop_search_preserves_literal_matching_filters_and_documents():
    async def run(db):
        await db.sellers.update_one({"id": "shop"}, {"$set": {"shop_name": "Marché [Sol]"}})
        await db.products.update_one({"id": "product"}, {"$set": {"country_code": "CD", "category": "Alimentation"}})
        await db.sellers.insert_one({"id": "other", "shop_name": "SOLEIL", "badge_verified": True})
        await db.products.insert_one({"id": "other-product", "name": "SOLEIL", "description": "", "seller_id": "other", "stock": 2, "price": 50, "currency": "FC", "is_active": True, "country_code": "CD"})
        before = {name: await db[name].find({}).sort("id", 1).to_list(100) for name in ["products", "sellers"]}

        async def search(**changes):
            arguments = dict(q="[Sol]", category=None, country_code="CD", lat=None, lng=None, radius_km=50, verified_only=False, sort="newest", limit=60)
            arguments.update(changes)
            return await list_products(**arguments)

        assert [p["id"] for p in await search()] == ["product"]
        assert await search(verified_only=True) == []
        assert await search(category="Maison") == []
        assert await search(country_code="CM") == []
        assert await search(q="absent") == []
        assert [p["id"] for p in await search(q="TEST")] == ["product"]
        after = {name: await db[name].find({}).sort("id", 1).to_list(100) for name in ["products", "sellers"]}
        assert after == before

    asyncio.run(isolated(run))
