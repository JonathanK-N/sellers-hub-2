"""AfriMarket backend pytest suite - covers auth, products, orders, seller, admin flows."""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sellers-hub-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Use unique phone numbers per run to avoid collisions
RUN_TAG = uuid.uuid4().hex[:6]
BUYER_PHONE = f"+24381{int(time.time()) % 10000000:07d}"
SELLER_PHONE = f"+24382{int(time.time()) % 10000000:07d}"
ADMIN_PHONE = "+243000000001"


# Shared state across tests
state = {}


# ---------- Health & countries ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_countries():
    r = requests.get(f"{API}/countries", timeout=15)
    assert r.status_code == 200
    items = r.json()
    codes = {c["code"] for c in items}
    assert codes == {"CD", "CM", "CI", "SN", "BJ"}
    for c in items:
        assert c["is_active"] is True


# ---------- Auth ----------
def _verify(phone, code):
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": code}, timeout=15)
    return r


def test_register_buyer():
    r = requests.post(f"{API}/auth/register", json={
        "name": f"TEST_Buyer_{RUN_TAG}", "phone": BUYER_PHONE, "role": "buyer", "country_code": "CD"
    }, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "otp_dev" in data
    assert len(data["otp_dev"]) == 6
    state["buyer_otp"] = data["otp_dev"]
    state["buyer_phone"] = data["phone"]


def test_register_duplicate():
    r = requests.post(f"{API}/auth/register", json={
        "name": "Dup", "phone": BUYER_PHONE, "role": "buyer", "country_code": "CD"
    }, timeout=15)
    assert r.status_code == 400


def test_verify_buyer_otp():
    r = _verify(BUYER_PHONE, state["buyer_otp"])
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "buyer"
    state["buyer_token"] = data["access_token"]
    state["buyer_id"] = data["user"]["id"]


def test_verify_wrong_code():
    # New OTP since previous was consumed
    r = requests.post(f"{API}/auth/send-otp", json={"phone": BUYER_PHONE}, timeout=15)
    assert r.status_code == 200
    r = _verify(BUYER_PHONE, "000000" if r.json()["otp_dev"] != "000000" else "111111")
    assert r.status_code == 400


def test_me_endpoint():
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {state['buyer_token']}"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["phone"] == BUYER_PHONE


def test_me_unauthorized():
    r = requests.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401


def test_register_seller_and_login():
    r = requests.post(f"{API}/auth/register", json={
        "name": f"TEST_Seller_{RUN_TAG}", "phone": SELLER_PHONE, "role": "seller", "country_code": "CD"
    }, timeout=15)
    assert r.status_code == 200, r.text
    otp = r.json()["otp_dev"]
    r = _verify(SELLER_PHONE, otp)
    assert r.status_code == 200, r.text
    state["seller_token"] = r.json()["access_token"]
    state["seller_user_id"] = r.json()["user"]["id"]


def test_admin_login():
    r = requests.post(f"{API}/auth/send-otp", json={"phone": ADMIN_PHONE}, timeout=15)
    assert r.status_code == 200, r.text
    otp = r.json()["otp_dev"]
    r = _verify(ADMIN_PHONE, otp)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "admin"
    state["admin_token"] = r.json()["access_token"]


# ---------- Seller setup ----------
def _sh(token):
    return {"Authorization": f"Bearer {token}"}


def test_seller_setup():
    r = requests.post(f"{API}/seller/setup", json={
        "shop_name": f"TEST_Shop_{RUN_TAG}",
        "description": "Boutique test",
        "category": "Général",
        "address": "Av Test",
        "neighborhood": "Gombe",
        "opening_hours": "08:00-20:00",
        "latitude": -4.325, "longitude": 15.322,
    }, headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200, r.text
    seller = r.json()
    assert seller["shop_name"].startswith("TEST_Shop_")
    assert seller["location"]["coordinates"] == [15.322, -4.325]
    state["seller_id"] = seller["id"]


def test_buyer_cannot_call_seller_setup():
    r = requests.post(f"{API}/seller/setup", json={
        "shop_name": "X", "latitude": 0, "longitude": 0
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 403


# ---------- Product creation ----------
def test_create_product():
    r = requests.post(f"{API}/products", json={
        "name": f"TEST_Product_{RUN_TAG}",
        "description": "Lampe solaire test",
        "price": 25.0,
        "stock": 5,
        "category": "Solaire",
        "photos": ["/api/files/dummy"],
    }, headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["seller_id"] == state["seller_id"]
    assert p["stock"] == 5
    state["product_id"] = p["id"]

    # GET to verify
    g = requests.get(f"{API}/products/{p['id']}", timeout=15)
    assert g.status_code == 200
    body = g.json()
    assert body["seller_name"].startswith("TEST_Shop_")


def test_buyer_cannot_create_product():
    r = requests.post(f"{API}/products", json={
        "name": "X", "price": 1, "stock": 1
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 403


def test_list_products_with_filters():
    # By country
    r = requests.get(f"{API}/products", params={"country_code": "CD", "sort": "newest"}, timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert any(p["id"] == state["product_id"] for p in items)

    # Geo proximity: near shop
    r = requests.get(f"{API}/products", params={
        "lat": -4.325, "lng": 15.322, "radius_km": 5, "sort": "nearest"
    }, timeout=15)
    assert r.status_code == 200
    matched = [p for p in r.json() if p["id"] == state["product_id"]]
    assert matched, "Product near coords should be returned"
    assert matched[0]["distance_km"] is not None

    # Geo far away
    r = requests.get(f"{API}/products", params={
        "lat": 48.85, "lng": 2.35, "radius_km": 1
    }, timeout=15)
    assert r.status_code == 200
    assert not any(p["id"] == state["product_id"] for p in r.json())

    # Search by name
    r = requests.get(f"{API}/products", params={"q": f"TEST_Product_{RUN_TAG}"}, timeout=15)
    assert r.status_code == 200
    assert any(p["id"] == state["product_id"] for p in r.json())


# ---------- Orders & escrow ----------
def test_create_order():
    r = requests.post(f"{API}/orders", json={
        "items": [{"product_id": state["product_id"], "quantity": 2}],
        "delivery_mode": "delivery",
        "delivery_address": "Av Test",
        "delivery_neighborhood": "Gombe",
        "payment_method": "mtn",
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 201, r.text
    resp = r.json()
    assert "order_group_id" in resp
    assert resp["seller_count"] == 1
    o = resp["orders"][0]
    assert o["status"] == "confirmed"
    assert o["escrow_status"] == "held"
    assert len(o["confirmation_code"]) == 6
    assert o["commission_amount"] == round(50.0 * 0.07, 2)
    state["order_id"] = o["id"]
    state["confirmation_code"] = o["confirmation_code"]

    # Stock decremented
    g = requests.get(f"{API}/products/{state['product_id']}", timeout=15)
    assert g.json()["stock"] == 3


def test_buyer_cannot_advance_order():
    r = requests.post(f"{API}/orders/{state['order_id']}/advance",
                      headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 403


def test_seller_advances_order():
    r = requests.post(f"{API}/orders/{state['order_id']}/advance",
                      headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "preparing"

    r = requests.post(f"{API}/orders/{state['order_id']}/advance",
                      headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "out_for_delivery"


def test_confirm_delivery_wrong_code():
    r = requests.post(f"{API}/orders/{state['order_id']}/confirm-delivery",
                      json={"code": "000000" if state["confirmation_code"] != "000000" else "111111"},
                      headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 400


def test_confirm_delivery_correct():
    r = requests.post(f"{API}/orders/{state['order_id']}/confirm-delivery",
                      json={"code": state["confirmation_code"]},
                      headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["escrow_status"] == "released"

    # GET to verify timeline
    g = requests.get(f"{API}/orders/{state['order_id']}", headers=_sh(state["buyer_token"]), timeout=15)
    assert g.status_code == 200
    assert g.json()["status"] == "delivered"
    assert g.json()["escrow_status"] == "released"


def test_my_orders():
    r = requests.get(f"{API}/orders/my", headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 200
    assert any(o["id"] == state["order_id"] for o in r.json())


def test_multi_seller_cart_splits_into_suborders():
    # Create another seller w/ product
    phone2 = f"+24389{int(time.time()) % 10000000:07d}"
    r = requests.post(f"{API}/auth/register", json={
        "name": "TEST_Seller2", "phone": phone2, "role": "seller", "country_code": "CD"
    }, timeout=15)
    otp = r.json()["otp_dev"]
    tok2 = _verify(phone2, otp).json()["access_token"]
    requests.post(f"{API}/seller/setup", json={
        "shop_name": "TEST_Shop2", "latitude": -4.3, "longitude": 15.3,
    }, headers=_sh(tok2), timeout=15)
    p2 = requests.post(f"{API}/products", json={
        "name": "TEST_P2", "price": 10, "stock": 3, "category": "Général", "photos": [],
    }, headers=_sh(tok2), timeout=15).json()

    r = requests.post(f"{API}/orders", json={
        "items": [
            {"product_id": state["product_id"], "quantity": 1},
            {"product_id": p2["id"], "quantity": 1},
        ],
        "delivery_mode": "delivery",
        "payment_method": "mtn",
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 201, r.text
    resp = r.json()
    # Two sellers -> two sub-orders under one group
    assert resp["seller_count"] == 2
    assert len(resp["orders"]) == 2
    group_id = resp["order_group_id"]
    # Each sub-order has its own escrow + confirmation code
    for o in resp["orders"]:
        assert o["order_group_id"] == group_id
        assert o["escrow_status"] == "held"
        assert len(o["confirmation_code"]) == 6
    # Group recap endpoint works
    g = requests.get(f"{API}/order-groups/{group_id}", headers=_sh(state["buyer_token"]), timeout=15)
    assert g.status_code == 200, g.text
    assert g.json()["seller_count"] == 2


# ---------- Admin ----------
def test_non_admin_blocked():
    r = requests.get(f"{API}/admin/overview", headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 403


def test_admin_overview():
    r = requests.get(f"{API}/admin/overview", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["users_count"] >= 2
    assert "by_country" in d


def test_admin_users_list():
    r = requests.get(f"{API}/admin/users", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200
    assert any(u["phone"] == BUYER_PHONE for u in r.json())


def test_admin_sellers_list():
    r = requests.get(f"{API}/admin/sellers", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200
    assert any(s["id"] == state["seller_id"] for s in r.json())


def test_admin_kyc_pending_and_approve():
    r = requests.get(f"{API}/admin/kyc/pending", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200
    pending = r.json()
    assert any(s["id"] == state["seller_id"] for s in pending)

    r = requests.post(f"{API}/admin/kyc/{state['seller_id']}/approve",
                      headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200

    # Verify badge
    r = requests.get(f"{API}/admin/sellers", headers=_sh(state["admin_token"]), timeout=15)
    seller = next(s for s in r.json() if s["id"] == state["seller_id"])
    assert seller["badge_verified"] is True
    assert seller["kyc_status"] == "level3"


# ---------- Upload photo ----------
def test_upload_photo():
    # 1x1 png
    png_bytes = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6300010000000500010d0a2db40000000049454e44ae426082"
    )
    files = {"file": ("test.png", io.BytesIO(png_bytes), "image/png")}
    r = requests.post(f"{API}/seller/upload-photo", files=files,
                      headers=_sh(state["seller_token"]), timeout=60)
    if r.status_code == 500:
        pytest.skip(f"Storage unavailable: {r.text}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "id" in body and "url" in body
    file_id = body["id"]

    g = requests.get(f"{API}{body['url'].replace('/api', '')}" if body["url"].startswith("/api") else f"{API}/files/{file_id}", timeout=30)
    # the constructed URL should be /api/files/{id}
    g = requests.get(f"{API}/files/{file_id}", timeout=30)
    assert g.status_code == 200
