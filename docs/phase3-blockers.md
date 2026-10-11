# Blocages et reprise de phase 3

Auteur : Jonathan Kakesa (JonathanK-N).

Le code candidat est gelé à 058b6a5 ; les dix jobs CI passent. Le tag rc.3 et les artefacts doivent rester liés à cette source. Les rapports sont séparés du code afin qu’une mise à jour documentaire ne déplace pas le candidat.

1. BLOCKED — Railway applique tous les changements en attente ensemble. Le propriétaire a autorisé Web staging et conversion Mongo, mais le contrôle du connecteur a rejeté accept-deploy deux fois. Ne pas contourner ce refus par une connexion live, CLI ou autre API. Patch 6d13f9a6-4924-4c69-92e3-d351404d5136 préparé : Web rc.3, Mongo Dockerfile authentifié rc.3, volume 1024 MB et nom utilisateur. Ne pas l’appliquer incomplet.
2. BLOCKED — Définir et sceller MONGO_INITDB_ROOT_PASSWORD et MONGO_APP_PASSWORD dans le Mongo staging. Deux secrets distincts, au moins 32 caractères aléatoires ; privilégier 64 caractères hexadécimaux pour le mot de passe applicatif utilisable dans l’URI. Aucun secret ne doit être transmis dans le chat. Le connecteur ne permet pas de sceller. Puis configurer MONGO_URL de l’API via référence privée du compte afrimarket_staging, authSource de la base synthétique et replicaSet. Ne pas utiliser le compte root.
3. BLOCKED — Déployer l’API au candidat contrôlé seulement sur staging, vérifier hello/PRIMARY et santé version/SHA, puis régénérer les fixtures synthétiques autorisées et rejouer les parcours cash/concurrence/idempotence. Les comptes initiaux pourraient avoir disparu après conversion ; ne pas inventer un résultat avec les anciens tokens. Vérifier logs, disponibilité, mémoire et redémarrages après déploiement.
4. BLOCKED — Identifier le backend historique réellement porteur de credentials CinetPay sandbox ; la source examinée ne contient que les noms NOTIFY_URL et RETURN_URL. Configurer le contrat adapté au compte réel dans un espace protégé, sans réutiliser la configuration production ni copier des secrets en Git. Tester états opérateur, webhooks, réconciliation et droits de compte.
5. BLOCKED — Mettre en place un accès de sauvegarde production, backup cohérent chiffré, restauration indépendante et RPO/RTO mesurés. Le succès synthétique ne certifie pas une base en production.
6. BLOCKED — Réconcilier l’historique financier, doublons avant index uniques, devises, soldes et réservations incertaines. Ne jamais rendre des fonds disponibles sur la seule base d’un timeout fournisseur.
7. BLOCKED — Certifier PWA installée au niveau OS, Android physique/iOS, authentification WebView et Retour/modal/historique. Le smoke émulateur passe seulement les dix contrôles publiés ; il n’utilise pas un certificat de distribution.
8. NOT IMPLEMENTED — Remboursement externe et premium certifié. Les remboursements partiels restent suspendus jusqu’à définition de la règle frais/commission.

Toute migration, signature, fusion ou mise en production attend une approbation explicite après preuves. Décision actuelle : NO-GO production.
