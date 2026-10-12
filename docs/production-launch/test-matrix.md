# Matrice de tests

Auteur : Jonathan Kakesa (JonathanK-N).

| Fonction | Critères | État |
|---|---|---|
| Messages | IDOR, contexte multi-vendeur, pagination, XSS, longueur, spam, concurrence, replay, désactivation | PASS API Mongo local, 9 tests ; navigateur TESTING |
| WhatsApp | numéro professionnel vérifié, consentement, absence, normalisation, lien sans secrets | PASS API Mongo local, 6 tests ; bouton navigateur TESTING |
| Direct | réservation stock atomique, clé idempotente, déclarations, logistique, absence ledger/escrow/wallet, annulation et litige | PASS Mongo replica set local, 16 tests ; E2E TESTING |
| Régression | 88 tests phase 3 et audits inchangés | Backend CI 38204219475 PASS ; nouveau candidat TESTING ; scanner historique FAIL, exception exacte en attente |
| E2E | comptes synthétiques, navigateur responsive, offline/reconnexion, permissions | TODO |
| Staging | SHA exact HTTPS, métier et données persistées, performance, logs | BLOCKED |
| Production | backup et migration contrôlés, déploiement approuvé, smoke non destructif | BLOCKED |
