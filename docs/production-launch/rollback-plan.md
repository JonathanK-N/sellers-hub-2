# Retour arrière

Auteur : Jonathan Kakesa (JonathanK-N).

Avant déploiement : conserver snapshots de code/configurations, backup Mongo chiffré restaurable et inventaire des IDs/documents. Ne pas considérer le bundle Git comme backup métier.

En anomalie : suspendre les mutations affectées, remettre l’ancien build compatible seulement après contrôle des nouveaux documents payment_method=direct, préserver l’historique des déclarations et messages. Ne pas remettre une ancienne route financière sur des commandes directes. Aucun retrait de champs, effacement de messages, drop de collection ou restauration écrasant des écritures récentes sans plan et approbation.

Tester le retour de code sur staging, garder CinetPay désactivé et ne pas désactiver les transactions pour contourner Mongo.
