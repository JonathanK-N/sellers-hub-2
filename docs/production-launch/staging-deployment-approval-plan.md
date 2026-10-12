# Application du candidat sur staging isolé

Auteur : Jonathan Kakesa (JonathanK-N).

Projet AFRIMARKET-STAGING-20261010 (bc40e22f-b963-46fa-a64e-240f3aa954cd), environnement staging (0fea37a0-e334-4963-952e-d99ca7523ffd). Patch 6d13f9a6-4924-4c69-92e3-d351404d5136 : 24 changements préparés, aucune suppression, réseau privé conservé. Aucun changement de production.

Les trois services existants API, Web et Mongo sont épinglés à c492c70126a2ec9da71844c2d313df8e675c2ffb sur release/afrimarket-production-launch. API/Web conservent leurs répertoires backend/frontend et domaines staging. L’API utilise le compte Mongo afrimarket_staging limité à afrimarket_staging_synthetic, via références de variables privées ; paiement direct activé, CinetPay et actions financières historiques désactivés, seed désactivé.

Mongo passe de l’image éphémère mongo:8.0 au Dockerfile.mongodb-staging (8.0.32), avec authentification, replica set privé à un membre afrimarket-staging-rs, clé interne sur volume et volume 1024 MB monté sur /data/db. Les deux mots de passe standard distincts de 48 caractères ont été configurés sans déploiement avec autorisation explicite. Aucun secret affiché ni versionné.

Le propriétaire a autorisé la régénération des seules données synthétiques si l’export reste inaccessible. L’essai d’inventaire SSH a échoué faute de clé SSH locale, sans exécution Mongo distante. Le redémarrage pourra perdre les anciennes fixtures éphémères ; les nouvelles fixtures de validation seront créées uniquement sur staging, jamais en production. Une interruption du staging est attendue pendant les builds et le démarrage Mongo ; aucune durée certaine ne peut être annoncée.

Budget Mongo déjà présenté : environ 12 USD/mois à 1 GB RAM et 0,1 vCPU moyens, dont environ 0,16 USD pour le volume 1 GB ; consommation réelle variable.

Avant application : onze jobs CI réussis sur le SHA exact, parcours navigateur métier réussi sur l’artefact exact et nouvelle lecture du patch complet. Ensuite demander l’autorisation explicite d’appliquer ce patch API/Web/Mongo. Utiliser exclusivement accept_deploy ; si son contrôle refuse, conserver le refus et ne pas appliquer via CLI ou connexion live.

Après application : vérifier les trois déploiements et leurs SHA, health/version, authentification Mongo, droits du compte applicatif, transactions, persistance sur volume et parcours HTTPS avec fixtures synthétiques. Les seuils Lighthouse sur les sept pages et les tests PWA restent obligatoires avant tout GO production.
