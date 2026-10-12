# Journal de lancement

Auteur : Jonathan Kakesa (JonathanK-N).

Base vérifiée : b3f503b0ae91c82772f9795f39ed06a8af47040b, CI phase 3 verte. Branche release/afrimarket-production-launch. Bundle privé production-launch-before.bundle vérifié, 47 références. Les PR 1/2/3 et leurs 38 assets restent préservés.

| Tâche | Priorité | État | Constat / prochaine action |
|---|---|---|---|
| A01 Cartographie | P0 | IN_PROGRESS | GitHub et Railway inventoriés ; schéma Mongo réel inaccessible OAuth |
| D01 Conservation Mongo | P0 | BLOCKED | Aucun accès de sauvegarde/restauration production ; volume seul insuffisant |
| M01 Messagerie | P0 | IN_PROGRESS | Historique et polling présents ; permissions contextuelles, pagination, idempotence à compléter |
| W01 WhatsApp | P0 | TODO | Champ social_links.whatsapp_business existant sans vérification attestée |
| P01 Paiement direct | P0 | TODO | Nouveau parcours sans escrow ni crédits, avec déclarations auditables |
| S01 Staging | P0 | BLOCKED | Patch phase 3 non appliqué, variables scellées absentes ; refus du contrôle Railway conservé |
| L01 Production | P0 | BLOCKED | Backup restaurable, migration, staging et approbation concrète requis |

Le paiement direct rend CinetPay non bloquant ; les gates de protection des données restent obligatoires.
