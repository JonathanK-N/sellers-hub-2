# AfriMarket green restoration — preliminary 0.1.1-green.1

Restores historical brand colors while preserving UI-UX improvements. Adds shared Tailwind/CSS tokens, keyboard focus outline, PWA cache-version update and scoped cache cleanup. Removes nonexistent manifest screenshot. Fixes missing get_db import in backend health check. Adds regression/static tests and Web/backend/Android CI artifact jobs.

Reference A: main 6722492. Reference B: ui-ux 83be265, with actual deployed B frontend 0e24300 separately preserved. C: integration commit recorded in artifact metadata after commit. Source archives and checksums do not imply builds passed. No production promotion, database migration, live payment, refund or production signing occurred.

Acceptance remains incomplete until build/CI, full synthetic feature matrix, PWA install/update, Android device tests, verified backup/rollback and staging validation are complete. See test-report.md and release-evidence for actual outcomes.

Validated candidate: b71f84ece757f00208df300e99bd9b418ae5fb40, CI run 38087197065 SUCCESS (Web, backend nine tests, Android debug). Adds positive order quantity/nonnegative price-stock validation and preserves cached sessions on transient network failures. Draft release 409214759 contains twelve sanitized artifacts/manifests. Detailed acceptance and remaining blockers: mission-report.md and feature-matrix.md.
