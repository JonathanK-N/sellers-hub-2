# Test report — preliminary

Only evidence from actually executed commands may be marked PASS. Installation logs and command failures are retained under release-evidence. Static checks and mocked tests cannot certify complete workflows.

| Area | Status at preparation | Evidence / limitation |
|---|---|---|
| Git access/inventory | PASS | GitHub connector, fetched six branches |
| Railway production inventory | PASS | production-inventory.json |
| Source backup | PASS | seven remote archive branches/tags, verified Git bundle |
| Mongo coherent backup/restoration | BLOCKED | No verified dump or backup schedule |
| Main/UI backend equivalence | PASS | git diff backend empty before health fix |
| Static palette/PWA checks | Pending execution | static-validation.log |
| Service worker regression | Pending execution | service-worker-tests.log |
| Frontend build | BLOCKED initially | dependency download timed out; retry log retained |
| Backend unit regression | BLOCKED initially | pytest unavailable; installation in progress |
| Production public GET smoke | Pending execution | production-smoke.json |
| PWA installation/update/Lighthouse | BLOCKED | Browser evidence required |
| Android local build/device | BLOCKED | Java/SDK/adb absent |
| CI | Prepared | Actual run results required |
| Staging | Prepared | Actual deployments/tests required |

All buyer registration/login, search/filter, product detail, cart, order, payment, history, profile, notifications, messages and disputes flows are BLOCKED as full end-to-end certifications until tested using synthetic staging accounts. All seller registration/shop/products/orders/dashboard/wallet/KYC/premium flows, deliverer registration/validation/dashboard/deliveries/status flows and admin auth/users/sellers/products/KYC/disputes/fraud/deliverers/geography/orders flows have the same BLOCKED certification status. Premium payment availability is explicitly disabled in existing UI; mark its paid enrollment NOT IMPLEMENTED for the current user interface, rather than claiming a successful payment.

| Anomaly | Priority | Cause | Correction | State |
|---|---|---|---|---|
| Orange/black identity mismatch | P1 | UI-UX brand replacement | Provenance restoration + tokens | Implemented, browser validation pending |
| Deployed frontend differs from branch tip | P1 | Last two deploys failed | Preserve actual deployed SHA separately | Documented |
| False degraded health | P1 | get_db not imported | Import + mocked regression tests | Implemented, test pending |
| Missing PWA screenshot | P2 | Manifest references absent file | Remove entry | Implemented |
| Cache deletion too broad | P2 | Deletes all caches | Scope to afrimarket prefix | Implemented |
| Historical small-text contrast | P2 | Exact palette + white text | Focus outline; contrast changes need design resolution | Open |
| Favorite heart does nothing | P2 | Existing handler only preventDefault | No speculative feature added | Open |
| APK points to production URL | P1 for test package | Remote Capacitor server | Use explicit staging override for test artifact | Open |

Loop 1: observe production/branches → preserve references/config → restore theme → identify health/PWA defects → implement regression checks. Loop 2: build/test → retain dependency timeout and missing screenshot failures → registry retry/manifest fix → re-test → document. Do not change acceptance thresholds or remove failing tests to claim success.
