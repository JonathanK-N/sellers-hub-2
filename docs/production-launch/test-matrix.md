# Matrice de tests

Auteur : Jonathan Kakesa (JonathanK-N).

| Fonction | Critères | État |
|---|---|---|
| Messages | IDOR, contexte multi-vendeur, pagination, XSS, longueur, spam, concurrence, replay, désactivation | PASS API Mongo local, 9 tests ; navigateur TESTING |
| WhatsApp | numéro professionnel vérifié, consentement, absence, normalisation, lien sans secrets | PASS API Mongo local, 6 tests ; bouton navigateur TESTING |
| Direct | réservation stock atomique, clé idempotente, déclarations, logistique, absence ledger/escrow/wallet, annulation et litige | PASS Mongo replica set local, 16 tests ; E2E TESTING |
| Régression | 88 tests phase 3 et audits inchangés | CI 38251860341, dix jobs PASS pour c317886 ; nouveau candidat TESTING |
| E2E | comptes synthétiques, navigateur responsive, offline/reconnexion, permissions | 15 contrôles PASS c317886, loop4 ; extensions livreur/admin/pagination TESTING |
| HTTP auth/messagerie | inscription/login réels, replay, droits, token expiré, suspension | PASS confirmé en CI Linux d7a9c06 et c317886 |
| PWA upgrade | artefact 69d1ed6, v9 vers v10, caches tiers, offline, reprise | PASS navigateur desktop, 6 contrôles ; installation OS/appareil non certifiée |
| Staging | SHA exact HTTPS, métier et données persistées, performance, logs | BLOCKED |
| Production | backup et migration contrôlés, déploiement approuvé, smoke non destructif | BLOCKED |
