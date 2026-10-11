# Phase 2 — blocages et travaux restants

Auteur : Jonathan Kakesa (JonathanK-N). Décision : NO-GO production.

| Sujet | Résultat | Condition de résolution |
|---|---|---|
| Sauvegarde/restauration MongoDB production | BLOCKED | Propriétaire confirme aucun accès configuré. Fournir accès backup par gestionnaire de secrets, topologie, stockage chiffré, hôte de restauration ; exécuter et vérifier la procédure |
| Atomicité financière après interruption | FAIL | Transactions multi-collections ou journal durable/reprise ; tests d’interruption aux frontières commande/transaction/ledger/litige |
| Retrait positif staging | BLOCKED | MongoDB standalone sans transactions. Décider une topologie staging replica set avant toute configuration/coût nouveau ; ne pas activer un repli non atomique |
| Paiement sandbox fournisseur | BLOCKED | Fournisseur et credentials sandbox isolés, contrat signature/montant/devise/replay et scénarios refus/succès |
| Remboursement externe | NOT IMPLEMENTED | Implémenter un flux idempotent chez le fournisseur et certifier le retour d’argent sandbox |
| Remboursement partiel | BLOCKED | Suspension demandée par propriétaire ; règle frais de livraison/commission à définir avant réactivation |
| Dépendances de build Web | FAIL | Chaîne CRA/Jest/dev-server vulnérable ; correction/remplacement compatible puis nouveaux audits/builds/régressions |
| KYC/S3 | BLOCKED | Stockage staging isolé, bucket privé, droits et URLs signées ; tests upload/consultation/validation/permissions |
| SMS et push externe | BLOCKED | Configurations sandbox dédiées ; feed interne seul certifié |
| PWA installée et iOS/téléphone physique | BLOCKED | Appareils/sessions d’installation disponibles ; exécuter mise à jour, permissions, caméra, session, offline |
| Mise à jour Android entre builds distincts | BLOCKED | Compatibilité des signatures debug non certifiée ; test même APK ne remplace pas ancien→nouveau |
| Favoris | NOT IMPLEMENTED | Définition et implémentation métier ; bouton désactivé actuellement |

Les validations qui peuvent s’exécuter avec les accès actuels sont réalisées et leurs échecs sont conservés. Les secrets ne doivent pas être transmis dans le chat ni ajoutés au dépôt. Aucun changement de production n’est proposé comme moyen de contourner un blocage de staging.
