# Récupération MongoDB

Auteur : Jonathan Kakesa (JonathanK-N).

Production : BLOCKED. La configuration historique mongo:8.0, volume 5 GB et commande sans --replSet ne certifie ni backup cohérent ni restauration. Le propriétaire a confirmé qu'aucun accès de sauvegarde n'est configuré. Le connecteur expose configuration/noms mais ne permet pas mongodump, export, exécution dans le conteneur ou restauration. Aucune base réelle copiée, aucune URI/mot de passe exporté et aucune base de production écrasée. RPO/RTO production : NOT MEASURED.

Procédure synthétique réellement exécutée : MongoDB officiel 8.0.32, Database Tools 100.19.1 dont archive SHA256 527738a0f9ab2d80ea40cb8fc7a68f8e28664a2fd4e3b63626c2d4629aeb7f37 vérifié. Instance locale replica set isolée, trois collections synthétiques avec documents et index. Full mongodump --oplog --gzip sans filtre de base, chiffrement AES-256-GCM et clé hors dépôt protégée par ACL Windows. Déchiffrement et comparaison SHA256, restauration complète --oplogReplay sans renommage ni filtre vers un nouveau mongod loopback vide. Documents, index et somme du registre équilibrée vérifiés ; plaintext supprimé. La clé et l'archive chiffrée restent privées, jamais dans les assets GitHub.

Résultat local : PASS sur cette petite base synthétique au repos. Dump 54,766 s ; restauration 26,266 s. Ces temps ne sont pas un RTO de production, ni un benchmark de volumétrie réelle. Pas de certification d'un dump production sous charge. Preuve : release-evidence/phase3/mongodb-recovery-synthetic.json. Script restrictif : scripts/validate_mongodb_recovery.py. Il refuse les endpoints non loopback, les replica sets non prévus et une instance contenant d'autres namespaces ; la cible doit être vide.

Pour la production : choisir backup replica-set/cluster cohérent ou snapshot/quiescence compatible avec standalone ; obtenir un compte backup avec droits nécessaires, une destination chiffrée approuvée, la clé gérée séparément, rétention et supervision ; restaurer vers un environnement privé autorisé sans exposer de données personnelles. Fournir l'accès opérationnel et l'approbation de toute quiescence/migration requise avant exécution. Réutiliser les conditions détaillées de docs/mongodb-backup-restore.md. Le bundle Git vérifié en phase 3 protège le code et ne constitue jamais une sauvegarde MongoDB.

Référence : [mongodump et cohérence oplog](https://www.mongodb.com/docs/database-tools/mongodump/).
