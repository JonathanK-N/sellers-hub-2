# MongoDB — sauvegarde et restauration isolée

Auteur : Jonathan Kakesa (JonathanK-N). Statut : BLOCKED. Le propriétaire confirme qu’aucun accès de sauvegarde n’est configuré. Production inventoriée : MongoDB 8, volume 5 000 Mo monté sur /data/db ; aucun backup exploitable ni planning vérifié. Le staging synthétique est éphémère, sans volume. Aucun export de données personnelles n’a été réalisé.

## Accès requis

L’opérateur doit fournir, via gestionnaire de secrets, un accès MongoDB de sauvegarde, le résultat de hello (topologie), MongoDB Database Tools compatibles, un stockage privé chiffré, une clé de déchiffrement protégée séparément et un hôte privé autorisé pour restauration. Aucun mot de passe dans le chat, les arguments shell, Git ou les releases. Le connecteur Railway disponible ne propose ni export, ni shell MongoDB, ni restauration de snapshot. Aucun changement de production n’est autorisé dans cette phase.

## Cohérence

Sur replica set, préparer un dump complet avec --oplog ; sans filtre de base/collection. Restaurer le dump complet avec --oplogReplay dans une instance isolée conservant les namespaces. Ne pas combiner oplogReplay avec nsInclude, nsFrom ou nsTo. Vérifier la rétention de l’oplog pendant le dump et les erreurs du processus. [Documentation mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) et [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/).

Sur standalone, un mongodump pendant des écritures ne prouve pas une cohérence globale. Il faut une méthode de snapshot cohérente validée, ou une fenêtre sans écritures approuvée explicitement. Ne pas arrêter le backend, le scheduler ni verrouiller MongoDB sans cette approbation. La topologie reste à confirmer ; l’image mongo:8 seule ne prouve pas un replica set.

## Procédure opérationnelle à exécuter après obtention des accès

1. Vérifier la topologie, version serveur/FCV, version outils, rôle backup, taille/rétention oplog et espace disponible. Inventorier collections et définitions d’index sans exporter de documents dans les journaux.
2. Sur un hôte sécurisé avec Bash et age, stocker une configuration privée JSON (compatible YAML) contenant uri ; droits 0600. Préparer une clé publique age ; clé privée indépendante conservée dans le gestionnaire de secrets.
3. Pour un replica set uniquement, exécuter avec pipefail :

~~~bash
set -euo pipefail
umask 077
mongodump --config /secure/source-config.json --archive --gzip --oplog \
  2>/secure/backup-tool.log | age -r "$AFRI_BACKUP_RECIPIENT" \
  -o /secure/afrimarket-full.archive.gz.age
sha256sum /secure/afrimarket-full.archive.gz.age > /secure/afrimarket-full.sha256
~~~

4. Vérifier les codes de sortie des deux programmes, la présence/taille archive, son SHA-256 et le déchiffrement. Copier l’archive chiffrée et son manifeste vers un stockage privé distinct. Conserver date UTC, topologie, outils, source/fingerprint sans secrets, méthode de cohérence et collections/indexes attendus. Un checksum seul ne prouve pas la restauration.
5. Sur un hôte privé chiffré autorisé, créer une instance MongoDB 8 neuve, sans application ni scheduler connecté, sans accès aux API SMS/email/paiements et sans exposition réseau publique. Garder les namespaces d’origine ; ne jamais utiliser production ou le staging applicatif pour restaurer des données personnelles.
6. Après vérification que la cible est neuve et exclusivement destinée au test, déchiffrer et restaurer :

~~~bash
set -euo pipefail
age -d -i /secure/backup-private.key /secure/afrimarket-full.archive.gz.age | \
  mongorestore --config /secure/isolated-restore-config.json --archive --gzip --oplogReplay
~~~

7. Examiner les erreurs, collections/indexes restaurés, contraintes uniques, validate de chaque collection et compteurs. Les compteurs de référence doivent correspondre au point cohérent de sauvegarde ; un comptage live en cours de dump n’est pas une preuve. Comparer échantillons/hashes et relations commandes/groupes/transactions dans l’instance isolée, sans journaliser de données personnelles.
8. Consigner archive checksum, résultat restauration, validation collections/indexes, RPO/RTO mesurés et preuve d’isolation. Tester les clés de déchiffrement sur l’hôte de secours avant de considérer le backup exploitable.
9. Détruire les données de test selon la politique de conservation, uniquement après autorisation appropriée ; conserver l’archive chiffrée originale. Ne supprimer aucune sauvegarde de référence.

## Critères

PASS exige une archive cohérente chiffrée, clés récupérables, restauration isolée réussie, collections/indexes vérifiés et preuve d’isolation. État actuel BLOCKED : accès source/backup et hôte de restauration sécurisés absents. Déploiement production NO-GO tant que ce P0 reste ouvert. Les tests MongoDB CI n’utilisent que des données fictives et ne remplacent pas cette preuve.
