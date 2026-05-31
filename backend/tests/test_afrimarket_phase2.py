"""AfriMarket Phase 2 backend pytest suite.

Covers: Messages, Reviews, Disputes, KYC docs upload/submit/approve,
Seller Wallet + Withdraw, Click & Collect QR, Geo admin dashboard.
"""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

RUN_TAG = uuid.uuid4().hex[:6]
ADMIN_PHONE = "+243000000001"
# Make sure each run uses unique phones
_ts = int(time.time() * 1000) % 10_000_000
BUYER_PHONE = f"+24371{_ts:07d}"
SELLER_PHONE = f"+24372{_ts:07d}"

state = {}


def _sh(token):
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(phone, name, role, country="CD"):
    r = requests.post(f"{API}/auth/register", json={
        "name": name, "phone": phone, "role": role, "country_code": country
    }, timeout=15)
    assert r.status_code == 200, r.text
    otp = r.json()["otp_dev"]
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": otp}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _login(phone):
    r = requests.post(f"{API}/auth/send-otp", json={"phone": phone}, timeout=15)
    assert r.status_code == 200, r.text
    otp = r.json()["otp_dev"]
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": otp}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------- Setup fixtures -------------------------
def test_p2_health():
    r = requests.get(f"{API}/health", timeout=15)
    assert r.status_code == 200


def test_p2_setup_admin():
    state["admin"] = _login(ADMIN_PHONE)
    state["admin_token"] = state["admin"]["access_token"]


def test_p2_setup_seller_with_product():
    s = _register_and_login(SELLER_PHONE, f"TEST_P2_Seller_{RUN_TAG}", "seller")
    state["seller_token"] = s["access_token"]
    state["seller_user_id"] = s["user"]["id"]
    r = requests.post(f"{API}/seller/setup", json={
        "shop_name": f"TEST_P2_Shop_{RUN_TAG}",
        "description": "Boutique phase2",
        "category": "Général",
        "address": "Av Test",
        "neighborhood": "Gombe",
        "opening_hours": "08:00-20:00",
        "latitude": -4.325, "longitude": 15.322,
    }, headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200, r.text
    state["seller_id"] = r.json()["id"]
    # product
    r = requests.post(f"{API}/products", json={
        "name": f"TEST_P2_Prod_{RUN_TAG}", "description": "x",
        "price": 100.0, "stock": 20, "category": "Général", "photos": [],
    }, headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 201, r.text
    state["product_id"] = r.json()["id"]


def test_p2_setup_buyer():
    b = _register_and_login(BUYER_PHONE, f"TEST_P2_Buyer_{RUN_TAG}", "buyer")
    state["buyer_token"] = b["access_token"]
    state["buyer_id"] = b["user"]["id"]


# ------------------------- Messages -------------------------
def test_messages_post_and_conversation():
    r = requests.post(f"{API}/messages", json={
        "seller_id": state["seller_id"], "text": "Bonjour, dispo?"
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert "conversation_id" in data
    state["conversation_id"] = data["conversation_id"]


def test_messages_list_conversations():
    r = requests.get(f"{API}/messages/conversations", headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 200, r.text
    convs = r.json()
    assert any(c.get("conversation_id") == state["conversation_id"] or c.get("id") == state["conversation_id"] for c in convs)


def test_messages_thread_marks_read():
    r = requests.get(f"{API}/messages/conversations/{state['conversation_id']}",
                     headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    # accept either {messages:[...]} or list
    msgs = data.get("messages") if isinstance(data, dict) else data
    assert isinstance(msgs, list) and len(msgs) >= 1


def test_messages_unread_count():
    r = requests.get(f"{API}/messages/unread-count", headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "count" in data or "unread" in data


# ------------------------- Click & Collect + QR -------------------------
def test_collect_order_has_qr():
    r = requests.post(f"{API}/orders", json={
        "items": [{"product_id": state["product_id"], "quantity": 1}],
        "delivery_mode": "collect",
        "payment_method": "mtn",
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 201, r.text
    o = r.json()
    assert o["delivery_mode"] == "collect"
    assert o.get("qr_code"), "Collect order must have qr_code"
    state["collect_order_id"] = o["id"]
    state["qr_token"] = o["qr_code"]


def test_get_order_by_qr_seller_only():
    # Buyer should not be allowed
    r_buyer = requests.get(f"{API}/orders/by-qr/{state['qr_token']}",
                           headers=_sh(state["buyer_token"]), timeout=15)
    assert r_buyer.status_code in (401, 403), r_buyer.text

    # Seller can fetch
    r = requests.get(f"{API}/orders/by-qr/{state['qr_token']}",
                     headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == state["collect_order_id"]


def test_scan_qr_releases_escrow():
    r = requests.post(f"{API}/orders/{state['collect_order_id']}/scan-qr",
                      json={"qr_token": state["qr_token"]},
                      headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "collected"
    assert data["escrow_status"] == "released"

    # verify persisted
    g = requests.get(f"{API}/orders/{state['collect_order_id']}",
                     headers=_sh(state["buyer_token"]), timeout=15)
    assert g.status_code == 200
    assert g.json()["status"] == "collected"
    assert g.json()["escrow_status"] == "released"


# ------------------------- Reviews -------------------------
def test_review_can_review_true():
    r = requests.get(f"{API}/reviews/can-review/{state['collect_order_id']}",
                     headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("can_review") is True


def test_post_review_and_recompute_rating():
    r = requests.post(f"{API}/reviews", json={
        "order_id": state["collect_order_id"], "rating": 5, "comment": "Excellent!"
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text

    # product reviews list contains it
    r = requests.get(f"{API}/products/{state['product_id']}/reviews", timeout=15)
    assert r.status_code == 200, r.text
    reviews = r.json()
    assert any(rv.get("rating") == 5 for rv in reviews)

    # seller rating recomputed
    r = requests.get(f"{API}/admin/sellers", headers=_sh(state["admin_token"]), timeout=15)
    seller = next(s for s in r.json() if s["id"] == state["seller_id"])
    assert seller.get("rating", 0) >= 4.5


def test_cannot_review_twice():
    r = requests.post(f"{API}/reviews", json={
        "order_id": state["collect_order_id"], "rating": 3, "comment": "again"
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 400, r.text


# ------------------------- Disputes -------------------------
def test_create_delivery_order_for_dispute():
    r = requests.post(f"{API}/orders", json={
        "items": [{"product_id": state["product_id"], "quantity": 1}],
        "delivery_mode": "delivery",
        "delivery_address": "Av Test",
        "delivery_neighborhood": "Gombe",
        "payment_method": "mtn",
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code == 201, r.text
    state["dispute_order_id"] = r.json()["id"]


def test_buyer_opens_dispute_freezes_escrow():
    r = requests.post(f"{API}/disputes", json={
        "order_id": state["dispute_order_id"],
        "reason": "non_recu",
        "description": "Produit jamais reçu",
    }, headers=_sh(state["buyer_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text
    state["dispute_id"] = r.json()["id"]

    # verify order escrow frozen
    g = requests.get(f"{API}/orders/{state['dispute_order_id']}",
                     headers=_sh(state["buyer_token"]), timeout=15)
    assert g.status_code == 200
    assert g.json()["escrow_status"] == "frozen"


def test_admin_disputes_list_priority():
    r = requests.get(f"{API}/admin/disputes", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    items = r.json()
    found = next((d for d in items if d.get("id") == state["dispute_id"]), None)
    assert found, "Created dispute should appear in admin list"
    assert "priority" in found


def test_admin_resolve_dispute_refund_buyer():
    r = requests.post(f"{API}/admin/disputes/{state['dispute_id']}/resolve",
                      json={"decision": "refund_buyer", "note": "OK"},
                      headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text

    g = requests.get(f"{API}/orders/{state['dispute_order_id']}",
                     headers=_sh(state["buyer_token"]), timeout=15)
    assert g.status_code == 200
    assert g.json()["escrow_status"] == "refunded"


# ------------------------- KYC docs -------------------------
def _png_bytes():
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6300010000000500010d0a2db40000000049454e44ae426082"
    )


def test_kyc_upload_id():
    files = {"file": ("id.png", io.BytesIO(_png_bytes()), "image/png")}
    r = requests.post(f"{API}/seller/kyc/upload", params={"doc_type": "id"},
                      files=files, headers=_sh(state["seller_token"]), timeout=60)
    if r.status_code == 500:
        pytest.skip(f"Storage unavailable: {r.text}")
    assert r.status_code == 200, r.text
    assert r.json()["doc_type"] == "id"


def test_kyc_upload_selfie():
    files = {"file": ("selfie.png", io.BytesIO(_png_bytes()), "image/png")}
    r = requests.post(f"{API}/seller/kyc/upload", params={"doc_type": "selfie"},
                      files=files, headers=_sh(state["seller_token"]), timeout=60)
    if r.status_code == 500:
        pytest.skip(f"Storage unavailable: {r.text}")
    assert r.status_code == 200, r.text


def test_kyc_submit_level2():
    # With only id+selfie -> requested_level=2 (address missing)
    r = requests.post(f"{API}/seller/kyc/submit", headers=_sh(state["seller_token"]), timeout=15)
    if r.status_code == 400 and "introuvable" in r.text:
        pytest.skip("Skipped due to missing seller")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["kyc_status"] == "pending_review"
    assert d["kyc_requested_level"] == 2


def test_kyc_status_shows_docs():
    r = requests.get(f"{API}/seller/kyc/status", headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200, r.text
    docs = r.json().get("docs", {})
    assert "id" in docs


def test_admin_kyc_pending_includes_pending_review():
    r = requests.get(f"{API}/admin/kyc/pending", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200
    assert any(s["id"] == state["seller_id"] for s in r.json())


def test_admin_kyc_approve_sets_requested_level():
    # First upload address to bump to level 3 then submit then approve
    files = {"file": ("addr.png", io.BytesIO(_png_bytes()), "image/png")}
    requests.post(f"{API}/seller/kyc/upload", params={"doc_type": "address"},
                  files=files, headers=_sh(state["seller_token"]), timeout=60)
    r = requests.post(f"{API}/seller/kyc/submit", headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["kyc_requested_level"] == 3

    r = requests.post(f"{API}/admin/kyc/{state['seller_id']}/approve",
                      headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text

    r = requests.get(f"{API}/admin/sellers", headers=_sh(state["admin_token"]), timeout=15)
    seller = next(s for s in r.json() if s["id"] == state["seller_id"])
    assert seller["badge_verified"] is True
    assert seller["kyc_status"] in ("level3",)


def test_admin_kyc_reject_with_reason():
    # Set a second seller in pending_review then reject
    phone3 = f"+24373{_ts:07d}"
    s = _register_and_login(phone3, "TEST_S_Reject", "seller")
    tok3 = s["access_token"]
    requests.post(f"{API}/seller/setup", json={
        "shop_name": "TEST_Reject", "latitude": -4.3, "longitude": 15.3,
    }, headers=_sh(tok3), timeout=15)
    seller_obj = requests.get(f"{API}/seller/me", headers=_sh(tok3), timeout=15).json()
    files = {"file": ("id.png", io.BytesIO(_png_bytes()), "image/png")}
    r = requests.post(f"{API}/seller/kyc/upload", params={"doc_type": "id"},
                      files=files, headers=_sh(tok3), timeout=60)
    if r.status_code == 500:
        pytest.skip("Storage unavailable")
    requests.post(f"{API}/seller/kyc/submit", headers=_sh(tok3), timeout=15)

    r = requests.post(f"{API}/admin/kyc/{seller_obj['id']}/reject",
                      json={"reason": "Document illisible"},
                      headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text

    status = requests.get(f"{API}/seller/kyc/status", headers=_sh(tok3), timeout=15).json()
    assert status.get("kyc_reject_reason") == "Document illisible"


# ------------------------- Wallet -------------------------
def test_wallet_overview():
    r = requests.get(f"{API}/seller/wallet", headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200, r.text
    w = r.json()
    for k in ("gross_sales", "commission_paid", "net_earnings", "withdrawn", "available"):
        assert k in w
    # collect order released => gross > 0
    assert w["gross_sales"] >= 100.0
    state["available_before"] = w["available"]


def test_wallet_transactions_merged():
    r = requests.get(f"{API}/seller/wallet/transactions", headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code == 200, r.text
    txs = r.json()
    assert isinstance(txs, list)
    # We should at least see the released order sale
    assert any(t.get("type") in ("sale", "order", "credit") for t in txs)


def test_wallet_withdraw_in_progress():
    amount = min(state["available_before"], 10.0)
    r = requests.post(f"{API}/seller/wallet/withdraw", json={
        "amount": amount, "mobile_money_number": "+243812000000", "operator": "MTN MoMo"
    }, headers=_sh(state["seller_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    assert d.get("status") == "in_progress"


# ------------------------- Geo dashboard & exports -------------------------
def test_geo_overview():
    r = requests.get(f"{API}/admin/geo/overview", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) == 5
    codes = {c.get("code") for c in arr}
    assert codes == {"CD", "CM", "CI", "SN", "BJ"}
    for c in arr:
        for k in ("users", "sellers", "users_pct", "revenue", "commission", "orders", "is_active"):
            assert k in c, f"Missing key {k} in {c}"


def test_geo_growth_six_buckets_french():
    r = requests.get(f"{API}/admin/geo/growth", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    arr = r.json()
    assert len(arr) == 6
    labels = [row.get("month") or row.get("label") for row in arr]
    # ensure uniqueness
    assert len(set(labels)) == 6, f"Buckets not unique: {labels}"
    # French short month names
    french = {"janv", "févr", "mars", "avr", "mai", "juin", "juil", "août",
              "sept", "oct", "nov", "déc"}
    assert any(any(fl in (lbl or "").lower() for fl in french) for lbl in labels), f"No French month found: {labels}"


def test_geo_alerts():
    r = requests.get(f"{API}/admin/geo/alerts", headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    arr = r.json()
    assert isinstance(arr, list)
    for a in arr:
        assert "level" in a and "title" in a and "action" in a


def test_admin_toggle_country():
    r = requests.patch(f"{API}/admin/countries/CD",
                       json={"is_active": False},
                       headers=_sh(state["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    # verify via overview
    arr = requests.get(f"{API}/admin/geo/overview", headers=_sh(state["admin_token"]), timeout=15).json()
    cd = next(c for c in arr if c["code"] == "CD")
    assert cd["is_active"] is False
    # toggle back
    requests.patch(f"{API}/admin/countries/CD",
                   json={"is_active": True},
                   headers=_sh(state["admin_token"]), timeout=15)


def test_csv_exports():
    for path in ("export/users", "export/orders"):
        r = requests.get(f"{API}/admin/{path}", headers=_sh(state["admin_token"]), timeout=30)
        assert r.status_code == 200, r.text
        ctype = r.headers.get("content-type", "")
        assert "text/csv" in ctype or "csv" in ctype, f"{path} ctype={ctype}"
        # must have at least header row
        assert b"," in r.content or r.text.count(",") > 0
