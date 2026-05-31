"""Countries endpoints."""
from fastapi import APIRouter
from db import get_db

router = APIRouter(prefix="/countries", tags=["countries"])


@router.get("")
async def list_countries():
    db = get_db()
    items = await db.countries.find({"is_active": True}, {"_id": 0}).to_list(50)
    return items
