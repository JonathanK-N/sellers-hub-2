"""Pydantic models for AfriMarket."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, ConfigDict


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Countries ----------
class Country(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code: str  # CD, CM, CI, SN, BJ
    name: str
    currency: str  # FC, XAF, XOF
    currency_symbol: str
    dial_code: str
    flag: str
    mobile_money_operators: List[str]
    commission_rate: float = 0.07
    is_active: bool = True


# ---------- Users ----------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    phone: str
    role: str  # buyer | seller | admin
    country_code: str
    currency: str
    kyc_level: int = 1
    created_at: str


class RegisterRequest(BaseModel):
    name: str
    phone: str
    role: str  # buyer | seller | deliverer
    country_code: str
    password: str


class SendOtpRequest(BaseModel):
    phone: str


class VerifyOtpRequest(BaseModel):
    phone: str
    code: str


class LoginRequest(BaseModel):
    phone: str
    password: str


class AdminLoginRequest(BaseModel):
    phone: str
    password: str


class SetPasswordRequest(BaseModel):
    phone: str
    code: str
    new_password: str


# ---------- Sellers ----------
class SocialLinks(BaseModel):
    facebook: Optional[str] = None
    tiktok: Optional[str] = None
    whatsapp_business: Optional[str] = None
    instagram: Optional[str] = None


class SellerSetupRequest(BaseModel):
    shop_name: str
    description: str = ""
    long_description: str = ""           # texte long (histoire, valeurs, expertise)
    category: str = "Général"
    product_specialties: list = []       # ["Téléphones", "Accessoires", ...]
    address: str = ""
    neighborhood: str = ""
    opening_hours: str = ""
    shop_logo_url: Optional[str] = None
    shop_banner_url: Optional[str] = None  # photo de couverture
    latitude: float = 0.0
    longitude: float = 0.0
    social_links: Optional[SocialLinks] = None
    address: str = ""
    neighborhood: str = ""
    opening_hours: str = "08:00-18:00"
    latitude: float = 0.0
    longitude: float = 0.0
    shop_logo_url: Optional[str] = None


class SellerPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    shop_name: str
    description: str
    long_description: str = ""
    product_specialties: list = []
    category: str
    address: str
    neighborhood: str
    opening_hours: str
    shop_logo_url: Optional[str] = None
    shop_banner_url: Optional[str] = None
    social_links: Optional[Dict[str, Any]] = None
    kyc_status: str = "pending"
    badge_verified: bool = False
    rating: float = 0.0
    commission_rate: float = 0.07
    country_code: str
    location: Optional[Dict[str, Any]] = None
    created_at: str


# ---------- Products ----------
class ProductSpec(BaseModel):
    label: str
    value: str


class ProductCreateRequest(BaseModel):
    name: str
    description: str = ""
    long_description: str = ""   # description détaillée du produit
    specs: List[ProductSpec] = Field(default_factory=list)  # ex: [{"label":"Couleur","value":"Vert"}]
    price: float
    stock: int = 0
    category: str = "Général"
    photos: List[str] = Field(default_factory=list)


class ProductPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    seller_id: str
    name: str
    description: str
    price: float
    currency: str
    stock: int
    category: str
    photos: List[str]
    is_active: bool = True
    country_code: str
    created_at: str
    # Enriched fields
    seller_name: Optional[str] = None
    seller_verified: Optional[bool] = None
    seller_rating: Optional[float] = None
    distance_km: Optional[float] = None


# ---------- Orders ----------
class OrderItemRequest(BaseModel):
    product_id: str
    quantity: int


class OrderCreateRequest(BaseModel):
    items: List[OrderItemRequest]
    delivery_mode: str  # delivery | collect
    delivery_address: Optional[str] = None
    delivery_neighborhood: Optional[str] = None
    delivery_landmark: Optional[str] = None
    pickup_slot: Optional[str] = None
    payment_method: str  # mtn | airtel | wave | orange | cash


class OrderTimelineEvent(BaseModel):
    status: str
    label: str
    timestamp: str


class OrderPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    buyer_id: str
    seller_id: str
    items: List[Dict[str, Any]]
    total_amount: float
    commission_amount: float
    currency: str
    delivery_mode: str
    delivery_address: Optional[str] = None
    delivery_neighborhood: Optional[str] = None
    delivery_landmark: Optional[str] = None
    pickup_slot: Optional[str] = None
    payment_method: str
    status: str  # confirmed | preparing | out_for_delivery | delivered | collected | cancelled
    escrow_status: str  # held | released | refunded
    confirmation_code: str
    qr_code: Optional[str] = None
    timeline: List[Dict[str, Any]]
    country_code: str
    created_at: str
    # Enriched
    seller_name: Optional[str] = None
    buyer_name: Optional[str] = None


class ConfirmDeliveryRequest(BaseModel):
    code: str
