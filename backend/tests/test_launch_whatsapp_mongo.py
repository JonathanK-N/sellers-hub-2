"""Protected business contacts. Author: Jonathan Kakesa (JonathanK-N)."""
import asyncio
from unittest.mock import AsyncMock, patch
import pytest
from fastapi import HTTPException
from routers import whatsapp_router as whatsapp, sellers_router
from whatsapp_contact import public_contact, public_seller
from test_launch_messages_mongo import isolated

SELLER = {"id": "seller-user", "role": "seller", "phone": "+243812345678", "phone_verified": True}


def test_administrative_lists_preserve_identity_without_credential_or_otp_proof():
    from routers import admin_router
    async def run(db):
        await db.users.update_one({"id": "seller-user"}, {"$set": {"name": "TEST seller", "password_hash": "fixture.hash", "otp_code": "000000", "otp_expires_at": "TEST"}})
        await db.sellers.update_one({"id": "shop"}, {"$set": {"whatsapp_verification": {"hash": "fixture.hash", "salt": "fixture.salt"}}})
        with patch.object(admin_router, "get_db", return_value=db):
            users = await admin_router.list_users({"role": "admin"})
            shops = await admin_router.list_sellers({"role": "admin"})
        seller_user = next(u for u in users if u["id"] == "seller-user")
        assert seller_user["name"] == "TEST seller"
        assert not {"password_hash", "otp_code", "otp_expires_at"}.intersection(seller_user)
        shop = next(s for s in shops if s["id"] == "shop")
        assert shop["owner_name"] == "TEST seller"
        assert "whatsapp_verification" not in shop
    asyncio.run(isolated(run))


def test_verified_account_number_requires_consent_and_old_personal_field_is_not_public():
    async def run(db):
        await db.sellers.update_one({"id": "shop"}, {"$set": {"social_links": {"whatsapp_business": "+243899999999"}, "kyc_docs": {"private": "TEST"}}})
        assert public_contact(await db.sellers.find_one({"id": "shop"})) is None
        with patch.object(whatsapp, "get_db", return_value=db):
            contact = await whatsapp.configure(whatsapp.ContactRequest(phone=SELLER["phone"], visible=False), SELLER)
            assert contact["verified"] is True
            assert public_contact(await db.sellers.find_one({"id": "shop"})) is None
            await whatsapp.configure(whatsapp.ContactRequest(phone=SELLER["phone"], visible=True), SELLER)
        public = public_seller(await db.sellers.find_one({"id": "shop"}))
        assert public["whatsapp_contact"]["link"] == "https://wa.me/243812345678"
        assert "+243899999999" not in str(public)
        assert "kyc_docs" not in public
    asyncio.run(isolated(run))


def test_phone_change_invalidates_verification_and_wrong_or_old_code_cannot_publish():
    async def run(db):
        with patch.object(whatsapp, "get_db", return_value=db), patch.object(whatsapp, "require_otp_delivery"), patch.object(whatsapp, "send_otp_sms", new=AsyncMock(return_value=True)), patch.object(whatsapp, "generate_otp", return_value="123456"):
            contact = await whatsapp.configure(whatsapp.ContactRequest(phone="+243811111111", visible=True), SELLER)
            assert not contact["verified"]
            await whatsapp.send_code(SELLER)
            with patch.object(sellers_router, "get_db", return_value=db):
                assert "whatsapp_verification" not in await sellers_router.get_my_boutique(SELLER)
            with pytest.raises(HTTPException):
                await whatsapp.verify(whatsapp.CodeRequest(code="654321"), SELLER)
            await whatsapp.configure(whatsapp.ContactRequest(phone="+243822222222", visible=True), SELLER)
            with pytest.raises(HTTPException):
                await whatsapp.verify(whatsapp.CodeRequest(code="123456"), SELLER)
            assert public_contact(await db.sellers.find_one({"id": "shop"})) is None
    asyncio.run(isolated(run))


def test_five_wrong_attempts_lock_proof_and_valid_code_cannot_bypass_lock():
    async def run(db):
        with patch.object(whatsapp, "get_db", return_value=db), patch.object(whatsapp, "require_otp_delivery"), patch.object(whatsapp, "send_otp_sms", new=AsyncMock(return_value=True)), patch.object(whatsapp, "generate_otp", return_value="123456"):
            await whatsapp.configure(whatsapp.ContactRequest(phone="+243811111111", visible=True), SELLER)
            await whatsapp.send_code(SELLER)
            for _ in range(5):
                with pytest.raises(HTTPException):
                    await whatsapp.verify(whatsapp.CodeRequest(code="654321"), SELLER)
            with pytest.raises(HTTPException):
                await whatsapp.verify(whatsapp.CodeRequest(code="123456"), SELLER)
            assert public_contact(await db.sellers.find_one({"id": "shop"})) is None
    asyncio.run(isolated(run))


def test_successful_otp_verifies_business_contact_and_cannot_be_replayed():
    async def run(db):
        with patch.object(whatsapp, "get_db", return_value=db), patch.object(whatsapp, "require_otp_delivery"), patch.object(whatsapp, "send_otp_sms", new=AsyncMock(return_value=True)), patch.object(whatsapp, "generate_otp", return_value="123456"):
            await whatsapp.configure(whatsapp.ContactRequest(phone="+243811111111", visible=True), SELLER)
            await whatsapp.send_code(SELLER)
            await whatsapp.verify(whatsapp.CodeRequest(code="123456"), SELLER)
            assert public_contact(await db.sellers.find_one({"id": "shop"}))["verified"] is True
            with pytest.raises(HTTPException):
                await whatsapp.verify(whatsapp.CodeRequest(code="123456"), SELLER)
    asyncio.run(isolated(run))


def test_failed_sms_cannot_claim_success_or_leave_a_verifiable_code():
    async def run(db):
        with patch.object(whatsapp, "get_db", return_value=db), patch.object(whatsapp, "require_otp_delivery"), patch.object(whatsapp, "send_otp_sms", new=AsyncMock(return_value=False)):
            await whatsapp.configure(whatsapp.ContactRequest(phone="+243811111111", visible=True), SELLER)
            with pytest.raises(HTTPException) as error:
                await whatsapp.send_code(SELLER)
            assert error.value.status_code == 503
            assert "whatsapp_verification" not in await db.sellers.find_one({"id": "shop"})
    asyncio.run(isolated(run))


def test_dashboard_and_buyer_profile_do_not_disclose_handoff_codes_or_otp_proof():
    async def run(db):
        await db.sellers.update_one({"id": "shop"}, {"$set": {"whatsapp_verification": {"digest": "TEST", "salt": "TEST"}}})
        await db.orders.update_one({"id": "order"}, {"$set": {"confirmation_code": "123456", "qr_code": "TEST-private", "total_amount": 100, "commission_amount": 7, "status": "confirmed", "escrow_status": "held"}})
        with patch.object(sellers_router, "get_db", return_value=db):
            dashboard = await sellers_router.dashboard(SELLER)
            assert "whatsapp_verification" not in dashboard["shop"]
            assert "confirmation_code" not in dashboard["recent_orders"][0]
            profile = await sellers_router.get_buyer_profile("buyer", SELLER)
            assert "confirmation_code" not in profile["orders"][0]
            with pytest.raises(HTTPException):
                await sellers_router.get_buyer_profile("other", SELLER)
    asyncio.run(isolated(run))
