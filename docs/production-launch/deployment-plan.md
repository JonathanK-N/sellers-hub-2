# Plan de déploiement

Auteur : Jonathan Kakesa (JonathanK-N).

Production existante : projet 7cf04965-3d75-4965-9e76-cd33c3b716c5, environnement 7382f536-2e97-4ac4-ba22-ff7dd1e06ecf. API 69e4d050-47d4-4e24-8d0d-d47807f4b99a ; Web 708bc9c5-90ae-47e7-a2ab-8c718c44b2ed ; Mongo 8807024a-a89f-4c55-8b4b-fb49641c58c3 avec volume 5 GB existant. Domaines afri-market.app et afrimarket.up.railway.app ; API sellers-hub-2-production.up.railway.app. API/Web suivent main. Métadonnées de déploiement établissent auteur/SHA, pas la raison métier de ce choix.

1. Backup production cohérent et restauration indépendante, inventaire des collections/index, contrôle des doublons.
2. Plan Mongo transactionnel non destructif avec coût/indisponibilité et approbation ; conserver le volume et tous les identifiants.
3. Migrations additives testées sur données représentatives protégées, sans seed de production.
4. Déployer candidat exact sur staging isolé bc40e22f-b963-46fa-a64e-240f3aa954cd et valider les parcours directs.
5. Préparer artefacts exacts et rollback, puis approbation finale des changements de production.
6. API compatible, smoke, puis Web, parcours non destructifs et contrôle des données/logs.

Ne pas appliquer l’ancien patch staging incomplet avant vérification de toutes ses variables et modifications. Aucun nouveau service de production.
