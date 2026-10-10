# Architecture AfriMarket — 2026-10-10

React 19 + CRA/CRACO + Tailwind, React Router 7, TanStack Query, Axios. UI/UX includes authentication modal, cart drawer, responsive product grids, Poppins and reduced-motion-aware animations. FastAPI provides `/api` routes; Motor/PyMongo connects MongoDB 8. Storage integrations include S3, SMS, email and sandbox/live payment adapters. APScheduler manages background work.

Production inventory and exact deployed SHAs: `release-evidence/production-inventory.json`. Frontend and backend are independently deployed from ui-ux and main. No production service was modified during this intervention.

Authentication uses JWT stored in browser localStorage. Authenticated, financial and personal-data flows require synthetic staging tests before approval. Code presence is not proof of operational behavior.
