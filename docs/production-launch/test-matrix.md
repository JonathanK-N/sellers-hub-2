# Matrice de tests

Auteur : Jonathan Kakesa (JonathanK-N).

| Fonction | Critères | État |
|---|---|---|
| Messages | IDOR, contexte multi-vendeur, pagination, XSS, longueur, spam, concurrence, replay, désactivation | PASS API Mongo, 9 tests ; navigateur c492c70 PASS, pagination et reprise incluses |
| WhatsApp | numéro professionnel vérifié, consentement, absence, normalisation, lien sans secrets | PASS API Mongo, 6 tests ; liens produit et commande inspectés en navigateur, aucun message externe envoyé |
| Direct | réservation stock atomique, clé idempotente, déclarations, logistique, absence ledger/escrow/wallet, annulation et litige | PASS Mongo replica set, 17 tests ; navigateur quatre rôles c492c70 PASS |
| Régression | tests historiques et nouveaux contrats directs | CI 38257880212 : onze jobs PASS pour c492c70, 123 tests backend, zéro échec/erreur/skip |
| E2E | comptes synthétiques, navigateur responsive, offline/reconnexion, permissions | 25 contrôles PASS sur artefact exact c492c70/build5abd42d, loop10 ; job Linux et CI globale PASS |
| HTTP auth/messagerie | inscription/login réels, replay, droits, token expiré, suspension | PASS confirmé en CI Linux d7a9c06 et c317886 |
| PWA upgrade | artefact c492c70, v9 vers v10, caches tiers, offline, reprise | PASS navigateur desktop, 6 contrôles ; installation OS/appareil non certifiée |
| Staging | SHA exact HTTPS, métier et données persistées, performance, logs | BLOCKED |
| Production | backup et migration contrôlés, déploiement approuvé, smoke non destructif | BLOCKED |
