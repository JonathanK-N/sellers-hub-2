# Phase 2 — proposition de déploiement

Auteur : Jonathan Kakesa (JonathanK-N). Décision actuelle : NO-GO.

## Staging exécuté

Projet `bc40e22f-b963-46fa-a64e-240f3aa954cd`, environnement `0fea37a0-e334-4963-952e-d99ca7523ffd`. Web `5a36eb00-531d-4aae-be1a-f8c63f241da3`, API `3a11fecf-70e7-4ba3-8744-d0156b9f7e6c`, Mongo `80a726a8-1cd5-4387-9e5d-8cd6c9671d9e`. Même environnement réutilisé ; aucun nouveau projet de production.

Les deux sources suivent la branche de stabilisation. MongoDB contient uniquement des données synthétiques, sans volume persistant, en standalone. AUTH_MODE et PAYMENT_MODE sandbox sont explicites. Les clés JWT/admin sont spécifiques au staging ; aucune clé de paiement/SMS/S3 de production n’est copiée. Les notifications vérifiées sont dans la base staging.

## Conditions avant une proposition de production

1. Sauvegarde cohérente chiffrée et restauration isolée réellement validées, avec topologie et procédure de récupération vérifiées.
2. Écritures financières durables et tests d’interruption/reprise ; validation montants, devises, commission, frais et idempotence.
3. Provider sandbox certifié pour succès/refus/replay et remboursement ; règle de remboursement partiel définie, ou maintien de sa suspension.
4. Audit Web accepté après corrections ; tests KYC/stockage et rôle complets.
5. Résultats Lighthouse HTTPS identifiant les assets réellement servis, PWA et APK correspondants au SHA proposé.
6. Rollback opérationnel répété sur staging et limites de données établies.

## Séquence à approuver explicitement ensuite

Présenter le SHA source compilé exact et ses checksums, les résultats CI/fonctionnels/Lighthouse/PWA/APK, la sauvegarde restaurée, les configurations privées requises et les risques résiduels. Obtenir l’approbation explicite du propriétaire avant tout merge vers une branche de production, changement de services Railway, migration ou publication Android.

Après cette approbation seulement : revérifier les déploiements actifs, conserver leurs images/variables, déployer dans l’ordre convenu, vérifier health et flows synthétiques autorisés, contrôler absence de mode sandbox et de données de test en production, monitorer les erreurs et appliquer les critères de rollback approuvés. Ne pas utiliser les comptes ou fixtures de staging en production.

Aucune étape de cette séquence de production n’a été exécutée pendant la phase 2.
