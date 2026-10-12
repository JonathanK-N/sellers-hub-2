# Sauvegarde cohérente de la production existante

Auteur : Jonathan Kakesa (JonathanK-N).

Inventaire en lecture seule du 12 octobre 2026 : 23 collections, 33 utilisateurs, 6 vendeurs, 23 produits, 28 commandes, environ 136 250 octets de données métier. MongoDB est standalone ; son volume existant est conservé. Aucun document n’a été modifié par cet inventaire.

## Opération proposée, soumise à approbation

Sur le Mongo production existant uniquement, utiliser `fsync` avec verrouillage pour empêcher les écritures pendant le calcul des empreintes et l’export de la base métier. Les écritures et certaines lectures peuvent attendre ou échouer pendant cette fenêtre. Durée estimée inférieure à une minute pour ce volume, sans garantie liée au réseau. Export limité à 120 secondes ; watchdog de déverrouillage après 180 secondes et nettoyage `finally`. En cas de perte totale de connectivité, le déverrouillage distant ne peut pas être garanti : arrêt du pipeline et intervention immédiate du propriétaire si nécessaire. Ne jamais annoncer un backup PASS si son intégrité ou le déverrouillage n’est pas confirmé.

Avant cette pause, préparer une instance temporaire locale neuve, liée uniquement à 127.0.0.1:27019, authentifiée par un mot de passe aléatoire. Le dossier, les fichiers de connexion temporaires, la clé de récupération et les données restaurées ont une ACL limitée au compte Windows courant. Aucun accès public, aucune connexion de cette copie aux applications ou fournisseurs, aucune réutilisation du staging.

L’archive compressée demeure en mémoire puis est chiffrée AES-256-GCM avant écriture sur disque. La clé reste dans un fichier privé distinct de l’archive, hors Git ; elle n’est pas envoyée dans le chat. Les secrets Railway passent en mémoire et via des fichiers de configuration temporaires protégés, supprimés après utilisation. Aucun secret dans les arguments des outils Mongo ou les preuves publiques.

Après déverrouillage, vérifier le déchiffrement authentifié, restaurer en mémoire vers l’instance locale et comparer chaque document BSON (incluant les identifiants) et chaque index par empreinte, ainsi que les comptages. Arrêter cette instance après vérification. Conserver l’archive chiffrée et la copie restaurée protégée pour audit de compatibilité. Aucune migration, modification de solde, suppression, seed, conversion replica set ou déploiement production n’est inclus dans cette approbation.

Script concret : scripts/production_mongo_backup.py. Gardes : proxy production exact et port 35998, approbation explicite, standalone, aucun verrou existant, dossier neuf, port local libre, base de moins de 100 MiB, restauration vide sans `--drop`, aucune publication des données.

## Preuves déjà exécutées

- release-evidence/production-launch-standalone-recovery.json : export synthétique, chiffrement, restauration authentifiée, documents/IDs/indexes identiques ; pause 0,25 seconde, restauration 1,84 seconde. Ces durées ne sont pas une mesure de production.
- release-evidence/production-launch-backup-failure-unlock.json : panne d’export injectée, verrou source relâché, aucun faux PASS.
- docs/production-launch/mongo-production-inventory.json : schéma/index/comptages sans valeurs personnelles.

MongoDB décrit le verrouillage et le déverrouillage dans sa [documentation fsync](https://www.mongodb.com/docs/manual/reference/command/fsync/) et recommande de protéger les configurations contenant des mots de passe dans la [documentation mongodump](https://www.mongodb.com/docs/database-tools/mongodump/).
