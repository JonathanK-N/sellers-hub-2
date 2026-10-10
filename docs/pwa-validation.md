# PWA validation

Manifest name/description, absolute start_url and scope, green theme/background, icon paths and PNG dimensions are checked by `scripts/validate_release.py`. A declared screenshot did not exist; its manifest entry was removed pending an actual browser screenshot.

Service worker cache changes from afrimarket-v6 to afrimarket-green-v7. Activation deletes only older AfriMarket caches, preserving unrelated caches. Tests in `scripts/test_service_worker.cjs` exercise activation, cross-origin `/api/` network-only behavior and offline 503 responses.

These are static and simulated worker tests. Android/desktop installation, iOS standalone behavior, installed-client cache upgrade, full offline navigation/session behavior and Lighthouse must be recorded separately as PASS/FAIL/BLOCKED. Do not equate a manifest check with installability. Existing worker catches failed precache installs and HTML may reference assets not yet cached; complete first-install offline behavior is not certified.
