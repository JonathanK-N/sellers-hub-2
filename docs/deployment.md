# Deployment preparation

Production was read only. Config snapshots without secret values: `release-evidence/production-inventory.json`. Production: project 7cf04965-3d75-4965-9e76-cd33c3b716c5 / environment 7382f536-2e97-4ac4-ba22-ff7dd1e06ecf.

Isolated staging project: bc40e22f-b963-46fa-a64e-240f3aa954cd; environment 0fea37a0-e334-4963-952e-d99ca7523ffd. Services: web 5a36eb00-531d-4aae-be1a-f8c63f241da3; API 3a11fecf-70e7-4ba3-8744-d0156b9f7e6c; Mongo 80a726a8-1cd5-4387-9e5d-8cd6c9671d9e.

Web: https://afrimarket-web-staging-staging.up.railway.app
API: https://afrimarket-api-staging-staging.up.railway.app

Staging references only its own private Mongo endpoint and synthetic database. New random JWT secret; PAYMENT_MODE=sandbox; no production SMS/email/payment/S3 credentials copied. Mongo staging is ephemeral, without a public proxy or persistent volume; data loss on restart is acceptable for synthetic test data. Production database backup/restore verification remains BLOCKED: volume existence is confirmed, backup schedule and coherent mongodump are not verified by available connector tools.

Production promotion requires explicit user approval after review of build/test evidence, required blockers and rollback readiness. No production branches may be directly updated during preparation.

Validated staging code SHA: b71f84ece757f00208df300e99bd9b418ae5fb40. Web deployment 26d4c19a-c892-4aa0-85f9-c8fd97165619 and API deployment 507be901-d5f2-43fc-899e-06911e7b22d8 both SUCCESS. Real browser session survives a simulated API disconnection (offline-session-after.json).

Final candidate 890d8e76341c3bb08f3d7452e7ecf87e08d222dd: web deployment 7bce18af-fd45-4eec-89e4-cee9a56b7bba and API deployment 900108da-d12c-4bca-8a9f-3b765413b8d3 both SUCCESS. Later documentation/test-harness commits do not alter application behavior.
