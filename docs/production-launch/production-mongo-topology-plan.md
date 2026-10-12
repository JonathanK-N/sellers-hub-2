# Compatibilité transactionnelle de Mongo production

Auteur : Jonathan Kakesa (JonathanK-N).

État vérifié : MongoDB 8.0.32 standalone, service 8807024a-a89f-4c55-8b4b-fb49641c58c3, volume existant 73f2765f-a5db-48f9-88b7-3f9a868b4842 de 5000 MB monté sur /data/db. L’API du candidat utilise des transactions pour réserver le stock et enregistrer les commandes. Déployer ce candidat sur le standalone actuel reste NO-GO.

Le backup cohérent AES-256-GCM et sa restauration authentifiée sont PASS. Les migrations additives sont PASS sur la copie protégée, sans modification de documents. La répétition locale de conversion, transactions avec compte limité, refus anonyme, redémarrage persistant et retour en standalone sur une seconde copie protégée est maintenant PASS : topology-copy-proof.json. Les 23 collections métier originales et les index après migration sont préservés. Aucun changement de topologie réel en production n’est autorisé par ces preuves.

Proposition à préparer et tester : conserver le service, la version 8.0.32, le volume, tous les documents/IDs/indexes et les identifiants root actuels ; ajouter un replica set à un membre, une clé d’authentification interne privée sur le volume et une adresse membre privée stable mongodb.railway.internal:27017. Ne pas réutiliser le bootstrap staging qui cible une base synthétique et un volume neuf.

Avant toute action réelle : reproduire la conversion sur une nouvelle restauration locale authentifiée du backup, comparer les documents avant/après, vérifier transactions et redémarrage persistant, puis tester la procédure de retour en standalone sur cette seule copie. Garder l’archive initiale intacte. Aucun seed, drop, recréation de volume ou effacement de données.

Préparer ensuite une configuration Railway concrète et un compte applicatif readWrite limité à la base métier, avec références de secrets hors Git et procédure de récupération. Ne pas modifier les secrets de production sans nécessité et autorisation documentées. Déterminer la mémoire, l’oplog, le coût et l’indisponibilité à partir des mesures du staging et du test sur copie.

Une approbation distincte du propriétaire est obligatoire pour le redémarrage et la conversion de production, ainsi que pour le déploiement API/Web final. L’autorisation du backup et celle de la conversion du staging ne couvrent pas ces actions. À ce stade : proposition uniquement, aucun changement Mongo production exécuté.
