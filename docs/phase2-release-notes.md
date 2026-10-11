# AfriMarket 1.0.1-green-rc.2 — notes de release

Auteur : Jonathan Kakesa (JonathanK-N). Candidate staging, production NO-GO.

Cette version préserve la palette verte historique et améliore le chargement de l’accueil, les contrastes, le comportement PWA hors ligne et l’APK de test. Elle corrige les réservations de stock avec lignes dupliquées, plusieurs accès aux commandes, les confirmations de remise et l’affichage d’escrow non payé.

Les paiements non configurés refusent l’opération. Les retraits requièrent des transactions MongoDB. Les remboursements partiels sont suspendus jusqu’à définition de la règle métier. Les uploads et l’authentification sont durcis ; les dépendances runtime et backend identifiées ont été corrigées.

La CI produit Web/PWA, APK debug, métadonnées source/build/API, checksums et rapports d’audit/performance/émulateur. Les audits conservés sont bloquants ; une release en brouillon ne signifie pas que la totalité de la validation passe.

Limites à lever : sauvegarde/restauration MongoDB, atomicité des écritures financières multi-collections, certification fournisseur sandbox et remboursement externe, chaîne de build Web vulnérable, KYC S3 et essais physiques/iOS. Les fonctionnalités non implémentées sont signalées dans l’interface et dans la matrice.

Aucun changement de production ni mouvement externe d’argent réel n’accompagne cette candidate.
