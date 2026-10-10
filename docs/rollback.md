# Rollback references and limitations

Before approval, verify the currently live deployments again. Reference frontend SHA 0e24300a3fa0cba3dcf8896e4617d9dec5fd3e84 / deployment 8e2af06c-8a30-4000-b690-f002c5a0cfef. Backend SHA 6722492d85e0f8646ebe03c9b841c4a0e3611449 / deployment edc47148-a47d-42df-9342-cdb2f2d2327e. Railway reported canRollback=true at inspection.

Restoring a branch tip is insufficient: the actual deployed frontend differs from the current ui-ux tip. Prefer the known deployment image or the deployed reference tag. Preserve the production domain, variables and root directories from the sanitized inventory. After rollback check health, routes, authentication, served assets and PWA update behavior. Never delete Mongo volume or restore data to production without explicit approval and a verified backup.

Verified source bundle: sibling private directory Afrimarket-private-backups/pre-restoration-20261010.bundle; `git bundle verify` succeeded with complete history. To inspect recovery, clone the bundle into a new directory and resolve reference tags. This is source recovery, not database recovery.

No production rollback was executed. End-to-end deployment rollback rehearsal and Mongo restoration are not yet certified.
