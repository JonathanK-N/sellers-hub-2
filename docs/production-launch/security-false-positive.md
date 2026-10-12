# Signalement de fixture par Gitleaks

Auteur : Jonathan Kakesa (JonathanK-N).

FAIL du run 38204219475 : generic-api-key sur la ligne 40 de backend/tests/test_launch_direct_mongo.py au commit 6955f6f0ad6fa0f95e71d11b0c06cc9b334f1596. La valeur correspond au paramètre de clé d’idempotence déterministe du checkout synthétique, pas à une credential, un secret API, une clé de chiffrement ou un accès fournisseur. Aucun appel externe ne peut être authentifié par cette valeur.

Empreinte proposée : 6955f6f0ad6fa0f95e71d11b0c06cc9b334f1596:backend/tests/test_launch_direct_mongo.py:generic-api-key:40. Exclusion limitée à cette occurrence historique, en conservant les règles par défaut et la recherche sur tout l’historique accessible. Aucun changement d’historique, de règle, de seuil ou d’exclusion globale de tests. Approbation demandée avant activation de cette exception ; le gate reste FAIL jusque-là. Le nouveau code utilise une fixture de faible entropie clairement synthétique pour éviter une nouvelle occurrence.
