# PWA validation

Manifest name/description, absolute start_url and scope, green theme/background, icon paths and PNG dimensions are checked by `scripts/validate_release.py`. A declared screenshot did not exist; its manifest entry was removed pending an actual browser screenshot.

Service worker cache changes from afrimarket-v6 to afrimarket-green-v7. Activation deletes only older AfriMarket caches, preserving unrelated caches. Tests in `scripts/test_service_worker.cjs` exercise activation, cross-origin `/api/` network-only behavior and offline 503 responses.

These are static and simulated worker tests. Android/desktop installation, iOS standalone behavior, installed-client cache upgrade, full offline navigation/session behavior and Lighthouse must be recorded separately as PASS/FAIL/BLOCKED. Do not equate a manifest check with installability. Existing worker catches failed precache installs and HTML may reference assets not yet cached; complete first-install offline behavior is not certified.

Executed staging evidence: browser-validation.json covers 390/768/1440 widths and authentication modal dismissal. pwa-cart-validation.json confirms authenticated add-to-cart, checkout route, real service-worker activation and cache afrimarket-green-v7. The initial offline-shell check used the guest header selector for an authenticated route. After correcting the selector, the cached authenticated shell reloaded offline with the original green header (PASS). Session refresh now preserves cached authentication on transient network/server failures and clears it on HTTP 401/403. Protected backend operations still validate the token. Physical installation and upgrade remain BLOCKED.

Explicit session regressions: service-worker interception disabled in the API simulation, refresh request observed, network abort preserves token/user (PASS); valid CORS HTTP 401 simulation clears token/user and redirects login (PASS). Initial rejection simulation without effective interception failed and is retained as test-harness diagnostic. No product workaround was added for that harness failure.

Lighthouse final status BLOCKED: initial dependency installation incomplete; retry failed to resolve debug; direct cached CLI was stopped after several minutes without producing a JSON report. No score is claimed. Attempt summary: release-evidence/lighthouse-status.json.
