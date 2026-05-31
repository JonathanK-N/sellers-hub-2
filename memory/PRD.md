# AfriMarket — PRD

## Original Problem Statement
Full-stack mobile-first marketplace PWA connecting buyers/sellers across francophone Africa (RD Congo, Cameroun, Côte d'Ivoire, Sénégal, Bénin). Buyers find products with GPS proximity radius filter, pay via Mobile Money (simulated), with escrow protection. Sellers run boutiques with KYC verification badges. Admin panel manages users, sellers, KYC, commissions. Everything in French. Platform commission 7%.

## Tech Stack (Adapted)
- Backend: FastAPI + MongoDB (motor) + JWT
- Frontend: React 19 PWA (mobile-first 360px) + Tailwind + Shadcn UI
- Auth: Phone + simulated SMS OTP (code returned in `otp_dev` API field for demo)
- Storage: Emergent object storage for product photos
- Geo: Haversine distance computation on backend (MongoDB 2dsphere index ready)
- Payment: SIMULATED Mobile Money (no real provider call)

## User Personas
1. **Buyer**: Discovers products near them, orders via Mobile Money, tracks delivery
2. **Seller**: Creates boutique, lists products (max 10 without KYC), receives orders, advances status
3. **Admin**: Manages platform, validates KYC, monitors commissions per country

## Core Requirements (Phase 1 MVP — IMPLEMENTED)
- [x] Registration with country selection + SMS OTP (simulated)
- [x] Login flow phone+OTP → JWT
- [x] Seller boutique creation + product listing with photo uploads (Emergent storage)
- [x] Buyer home + category pills + product grid
- [x] Search with proximity GPS radius slider (1-50 km) + filters
- [x] Cart with single-seller enforcement
- [x] Checkout with delivery (quartier + repère) OR Click & Collect (slot)
- [x] Mobile Money payment selection (simulated)
- [x] Escrow hold + 6-digit confirmation code → release
- [x] Order tracking timeline (4 steps)
- [x] Seller dashboard: revenue, orders breakdown, KYC notice
- [x] Admin overview: users/sellers/products/orders stats + commission per country
- [x] Admin KYC queue with approve/reject

## Implemented Endpoints
- `/api/auth/{register, send-otp, verify-otp, me}`
- `/api/countries`
- `/api/products` (GET with q, category, lat, lng, radius_km, verified_only, sort)
- `/api/products/{id}` (GET, DELETE)
- `/api/products` (POST seller)
- `/api/seller/{me, setup, upload-photo, dashboard, products}`
- `/api/orders` (POST), `/api/orders/my`, `/api/orders/{id}`
- `/api/orders/{id}/advance`, `/api/orders/{id}/confirm-delivery`
- `/api/admin/{overview, users, sellers, orders, kyc/pending}`
- `/api/admin/kyc/{seller_id}/{approve|reject}`
- `/api/files/{id}` (public photo serving)

## Backlog (P1 — Phase 2)
- Click & Collect QR scanner (UI exists, no real scan yet)
- In-app messaging buyer ↔ seller
- Reviews & ratings (post-delivery)
- KYC document upload UI (ID, selfie) — currently 1-click approval
- Dispute management workflow
- Geographic dashboard with growth charts (recharts)
- Seller wallet & Mobile Money withdrawal
- Multi-seller cart (MVP enforces single seller)

## Backlog (P2 — Phase 3)
- Push notifications via Firebase
- AI fraud detection
- Sponsored products / Premium seller badge
- Delivery partner (livreur) app
- Real Mobile Money integration (MTN MoMo, Wave, Orange Money) — needs provider keys

## Key Architectural Notes
- All API routes prefixed `/api`
- Phone is primary identifier (no email)
- OTP is simulated; backend returns `otp_dev` field and logs `[OTP-SIMULATED]`
- JWT in `Authorization: Bearer` header, 7-day expiry
- Currency never auto-converted between countries
- Commission rate stored per seller (default 7%)
- Escrow tracked as `escrow_status` field on order (held/released/refunded)
