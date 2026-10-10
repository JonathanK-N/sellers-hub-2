# Branch audit

| Branch | SHA | Finding |
|---|---|---|
| main | 6722492d85e0f8646ebe03c9b841c4a0e3611449 | Original palette; actual production backend |
| ui-ux | 83be26533e8bca3aa4ca1b1fa84c93f686aabec0 | Full UI redesign, cart/auth modals, Lenis/GSAP; latest tip not deployed |
| apk | 98d3e0c6e70eb0dfc3e8d84722bdc60d5d1801eb | Android hardening/build changes; main ancestor, no recent UI redesign |
| develop | 02c8ff47f00a20295ebdb9b510e1210b49dfe7b0 | Older premium state; missing later security/index/image/health changes |
| dev | 93a5ca30c5ac202e451f37b30c27d59e2ea0c912 | No merge-base returned against ui-ux; substantial older backend differences; do not merge blindly |
| backup | 64219d1162cf603651ad4edd2e44c0d7afd5a40c | Older ancestor; missing later backend improvements |

Actual production frontend: `0e24300a3fa0cba3dcf8896e4617d9dec5fd3e84`, deployment `8e2af06c-8a30-4000-b690-f002c5a0cfef`. Tip 83be265 deployment had failed. Integration starts from ui-ux to preserve all UI improvements. Backend in ui-ux matches main before the health import fix. APK configuration differences are reviewed, not blindly merged.

Seven backup branches published under `archive/afrimarket-*-20261010`; seven annotated tags under `release/afrimarket-*-pre-restoration-20261010` (deployed frontend uses `release/afrimarket-frontend-deployed-20261010`). The existing branch `backup` prevents creating remote `backup/...` refs. Existing branches were preserved. Git tags are conventional fixed references, not protected against administrator deletion; the verified offline bundle also preserves history.
