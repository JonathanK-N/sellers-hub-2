# AfriMarket — PRD

## Original Problem Statement
Full-stack mobile-first marketplace PWA connecting buyers/sellers across francophone Africa (RD Congo, Cameroun, Côte d'Ivoire, Sénégal, Bénin). Buyers find products with GPS proximity radius filter, pay via Mobile Money (simulated), with escrow protection. Sellers run boutiques with KYC verification badges. Admin panel manages users, sellers, KYC, commissions. Everything in French. Platform commission 7%.

## Tech Stack
- Backend: FastAPI + MongoDB (motor) + JWT
- Frontend: React 19 PWA (mobile-first 360px) + Tailwind + Shadcn UI + recharts + qrcode.react + html5-qrcode
- Auth: Phone + simulated SMS OTP (`otp_dev` field)
- Storage: Emergent object storage for product photos & KYC docs
- Geo: Haversine distance computation + MongoDB 2dsphere index ready
- Payment: SIMULATED Mobile Money (no real provider call)

## User Personas
1. **Buyer**: Discovers products near them, orders via Mobile Money, tracks delivery, leaves reviews, opens disputes
2. **Seller**: Creates boutique, lists products (max 10 without KYC), receives orders, advances status, scans QR for pickup, manages wallet & withdraws
3. **Admin**: Manages platform, validates KYC, monitors commissions per country, resolves disputes, toggles countries

## Phase 1 MVP — DONE ✅
- Registration with country selection + simulated OTP
- Login + JWT auth
- Seller boutique + product listing with photos (Emergent storage)
- Buyer home, category pills, search with GPS radius filter
- Cart, checkout (delivery + Mobile Money simulated)
- Escrow + 6-digit code confirmation
- Order tracking timeline
- Seller dashboard, admin overview (users/sellers/products/orders + commission per country), admin KYC queue

## Phase 2 — DONE ✅
1. **Click & Collect + QR**: Buyer order shows QR via qrcode.react. Seller `/seller/scan` page uses html5-qrcode camera OR manual token. Backend `POST /api/orders/{id}/scan-qr` releases escrow → status=collected.
2. **Messaging buyer↔seller**: `/messages` conversations list, `/messages/{convId}` chat (polls every 3s). Unread badge in TopBar. Conversation id format `buyerId__sellerId`.
3. **Reviews & ratings**: ReviewPrompt on OrderDetail after delivery; star rating 1-5 + comment. Only buyers of `delivered`/`collected` orders, one review per order. Seller.rating recomputed.
4. **KYC documents upload**: `/seller/kyc` 3-step page (id → selfie → address). Files stored in Emergent private folder. Submit sets `kyc_status=pending_review`. Admin approves with appropriate level (2 or 3), badge granted at level 3.
5. **Disputes**: Buyer button on OrderDetail → `/buyer/dispute/{orderId}`. Backend freezes `escrow_status=frozen`. Admin `/admin/disputes` page lists with priority (urgent if > 5 days). 3 decisions: refund_buyer / partial_refund / release_seller.
6. **Seller wallet**: `/seller/wallet` shows available balance (net = gross − commission − withdrawn). Withdraw modal posts to Mobile Money. Withdrawal status auto-completes after 2 min.
7. **Geographic admin dashboard**: `/admin/geo` — 5 country cards (users, sellers, orders, commission), 6-month bar chart (recharts), alerts panel, toggle country active/inactive, export CSV (users, orders).

## Backlog (P2 — Phase 3)
- Real Mobile Money integration (MTN MoMo, Wave, Orange) — needs provider keys
- Push notifications via Firebase (device token registration + prefs UI)
- Sponsored products / Premium seller badge

## Phase 3 — IN PROGRESS
- **Multi-seller cart — DONE ✅**: Cart can hold products from several sellers. `POST /orders` splits into one sub-order per seller under a shared `order_group_id`; each sub-order has its own escrow, confirmation code / QR, and commission (per-seller rate). Single Mobile Money charge for the whole cart (`order_groups` collection). New endpoint `GET /order-groups/{id}` returns the recap. Frontend: `CartContext.sellerGroups`, Cart groups by seller, new `OrderGroup.jsx` recap page at `/buyer/order-group/:groupId`. Seller notified per sub-order.
- **AI fraud detection UI — DONE ✅**: `fraud.py` scoring now wired up. Admin routes: `GET /admin/fraud/alerts`, `GET /admin/fraud/stats` (+ 7-day trend), `POST /admin/fraud/scan` (re-evaluate all), `POST /admin/fraud/{user_id}/action` (ignore/warn/suspend/ban). Evaluation auto-triggered on order creation. Frontend: `/admin/fraud` page with stat cards, 7-day bar chart (recharts), per-account score ring, signal chips, action buttons. Sidebar link added.
- **Withdrawal cron — DONE ✅**: `start_scheduler()` now called on startup in `server.py` (stopped on shutdown). `_compute_balance` no longer auto-completes on read; the APScheduler job (`process_pending_withdrawals`, every 1 min) is the single source of truth, with retry x3 → `manual_review`. Balance counts in_progress/processing/completed against available.
- **Delivery partner (livreur) app — DONE ✅**: New `deliverer` role allowed at registration. `delivery_router.py`: seller assigns via `GET /deliverers/available` + `POST /orders/{id}/assign`; deliverer uses `GET /deliverer/deliveries`, `/deliverer/earnings`, `POST /deliverer/orders/{id}/picked-up|en-route|confirm` (confirm takes the buyer's 6-digit code → escrow released). Admin: `GET /admin/deliverers`, `PATCH /admin/deliverers/{id}` (activate/deactivate). Order status flow for delivery now: confirmed → preparing → assigned → picked_up → out_for_delivery → delivered. Seller is blocked from advancing once a deliverer is assigned. Frontend: `/livreur` mobile dashboard (active deliveries, pickup/dropoff, status actions, code entry, earnings, history), assign-deliverer block in `OrderDetail`, `/admin/deliverers` management page. Registration adds a "Livrer" role option; role redirect sends deliverers to `/livreur`.

## Architectural Notes
- All API routes prefixed `/api`
- Phone is primary identifier
- OTP simulated; returned as `otp_dev` field
- JWT 7-day expiry in `Authorization: Bearer`
- Currency never auto-converted
- Commission auto-deducted at escrow release
- Order timeline append-only via `$push`
- Reviews bound to order_id (verified purchase only)
- KYC docs stored in private storage folder, file IDs in seller.kyc_docs map
