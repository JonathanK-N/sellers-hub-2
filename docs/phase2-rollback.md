# Phase 2 — rollback et reprise

Auteur : Jonathan Kakesa (JonathanK-N). Aucun rollback de production exécuté.

La phase 1 est préservée au tag `release/afrimarket-phase1-final-20261010`. Le bundle privé pré-restauration a été vérifié et cloné dans un répertoire isolé ; la récupération des références sources a passé son contrôle. Cela ne restaure ni les données MongoDB ni un environnement Railway complet.

Pour un rollback de code staging : conserver l’archive/artefact courant et ses métadonnées, sélectionner une image de déploiement staging connue, ou reconstruire une référence exacte avec l’API staging ; vérifier health, assets, authentification et données synthétiques. Ne pas changer la branche de production ou le volume MongoDB. Le changement de worker/cache peut faire perdre le cache hors ligne local, sans toucher aux données serveur.

Références production inventoriées, à revérifier avant toute intervention approuvée :

- Backend source `6722492d85e0f8646ebe03c9b841c4a0e3611449`, déploiement actuel `8ebcb33c-8c54-4fc4-afb0-8a5c717f3b4b` (initial : `edc47148-a47d-42df-9342-cdb2f2d2327e`).
- Frontend actuel `6722492d85e0f8646ebe03c9b841c4a0e3611449`, déploiement `63d6636f-035b-4596-83bc-5268ad33fd70`. Référence initiale conservée : `0e24300a3fa0cba3dcf8896e4617d9dec5fd3e84` / `8e2af06c-8a30-4000-b690-f002c5a0cfef`.
- Le tip `ui-ux` plus récent a échoué ; ne pas l’utiliser comme preuve de version active.

Une restauration financière doit partir d’une sauvegarde cohérente vérifiée, dans une instance isolée d’abord. Aucun restore sur la production, suppression de volume, écrasement de données ou arrêt d’écritures n’est autorisé par cette procédure seule. La [procédure MongoDB](mongodb-backup-restore.md) décrit l’accès manquant et les validations indispensables.

Rollback complet d’environnement et restauration de données : BLOCKED faute d’accès sauvegarde et de répétition opérationnelle. Le rollback de code ne compense pas des écritures financières déjà effectuées.
