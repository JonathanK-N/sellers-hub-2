# Journal de lancement

Auteur : Jonathan Kakesa (JonathanK-N).

Base vérifiée : b3f503b0ae91c82772f9795f39ed06a8af47040b, CI phase 3 verte. Branche release/afrimarket-production-launch. Bundle privé production-launch-before.bundle vérifié, 47 références. Les PR 1/2/3 et leurs 38 assets restent préservés.

| Tâche | Priorité | État | Constat / prochaine action |
|---|---|---|---|
| A01 Cartographie | P0 | IN_PROGRESS | GitHub et Railway inventoriés ; schéma Mongo réel inaccessible OAuth |
| D01 Conservation Mongo | P0 | BLOCKED | Aucun accès de sauvegarde/restauration production ; volume seul insuffisant |
| M01 Messagerie | P0 | TESTING | API Mongo, permissions, pagination et idempotence PASS ; E2E navigateur métier à vérifier |
| W01 WhatsApp | P0 | TESTING | Numéro professionnel vérifié et consentement implémentés ; 6 tests API PASS ; navigateur à vérifier |
| P01 Paiement direct | P0 | TESTING | 16 tests Mongo PASS sans fonds fictifs ; tests HTTP supplémentaires et E2E en cours |
| S01 Staging | P0 | BLOCKED | Patch phase 3 non appliqué, variables scellées absentes ; refus du contrôle Railway conservé |
| L01 Production | P0 | BLOCKED | Backup restaurable, migration, staging et approbation concrète requis |

Le paiement direct rend CinetPay non bloquant ; les gates de protection des données restent obligatoires.

Cycle M01 : 9 tests Mongo réels PASS sur loopback, dont 15 envois concurrents de la même clé -> une ligne et une notification, IDOR/contextes étrangers refusés, 125 messages paginés sans doublons, compte suspendu, débit 30/minute, XSS conservé comme texte et limites de modèle. Preuve locale : release-evidence/production-launch-messages-loop2.xml. Interface mobile modifiée ; build et tests navigateur encore TESTING, pas PASS.

Cycle P01/W01 (6955f6f) : 41 tests locaux ciblés PASS, dont 12 directs, 9 messages et 5 WhatsApp, plus régressions paiement/remise. Aucun mouvement de fonds dans les tests directs. CI 38204219475 : backend/builds/audits dépendances/SAST PASS ; scanner FAIL sur clé d’idempotence synthétique historique, exclusion exacte proposée mais non activée.

CLI Railway 5.64.2 vérifiée SHA-256. Login navigateur expiré après cinq minutes sans callback ; session authentifiée toujours BLOCKED. Lanceur privé railway-login.cmd disponible hors dépôt. Aucun token ou secret publié. Les tâches indépendantes continuent.

Cycle d’audit adversarial : solde historique marqué non payable avec retraits inactifs ; suppression des preuves OTP dans toutes les vues vendeur identifiées ; suppression des codes de remise dans dashboard et fiche acheteur ; transitions livreur conditionnelles ; devises natives au checkout et frais CDF non ajoutés comme USD. Version préparée 1.1.0-direct-rc.1, cache v10 et version Android code 5, sans déplacement des tags rc.2/rc.3. Tests frontend/e2e encore TESTING.

Cycle adversarial suivant : 21 tests directs/WhatsApp PASS (production-launch-adversarial-loop1.xml). Après correction des gains forfaitaires pour les livraisons directes et ajout d’un CAS revision/paiement lors de l’assignation : 16 tests directs PASS (production-launch-direct-loop3.xml), dont dix courses assignation/désaccord acheteur. Aucune commande assignée avec paiement non reçu. Cinq tests health/startup PASS, dont absence de seed par défaut et en production. Cache v10 : validation isolée PASS ; upgrade navigateur encore TESTING. La liste de conversations conserve les pages chargées pendant le polling.

Accès production : utilisateur choisit une session Railway CLI locale authentifiée. Nouvelle connexion navigateur lancée ; callback en attente. Aucune lecture de données métier et aucune sauvegarde production effectuée à ce stade.

Commit 69d1ed6197de9cee38852c2f0111c56c31caf8ad poussé. CI 38205480395 : backend/Web/Android/audits/topologie/restauration synthétique PASS ; scanner historique FAIL, performance/émulateur encore en cours à la vérification. Build Web 2ca5646b48f95148a4ad401a28c76ad139de14e4 téléchargé et SHA-256 9672c9f3379e7085f8a8f9cb65d53ce201bc3683dd2355ab535c28ed05004bdc vérifié.

PWA navigateur sur cet artefact exact : 6 contrôles PASS, ancienne version rc.3/v9 remplacée par v10, caches tiers préservés, landing offline, API offline 503, fallback lisible et reconnexion. Preuve production-launch-pwa-upgrade-69d1ed6.json. Ceci ne certifie ni staging HTTPS ni appareil physique.

Test HTTP ASGI avec Mongo réel : inscription/OTP synthétique/login acheteur-vendeur-livreur, configuration WhatsApp, message/replay/historique persistés, rôle livreur refusé 403, session expirée 401, compte suspendu 403. Assertions PASS ; avertissement natif Windows 0x8007000e pendant le teardown WMI de pytest malgré sortie 0, validation CI Linux requise avant gate PASS. Les deux premiers essais ont corrigé les attentes de contrat (POST messages 201, rôle livreur 403), sans changement des protections ni suppression d’assertions.

Deuxième login Railway expiré sans callback ; ne pas relancer automatiquement une troisième fois. Lanceur privé disponible pour connexion interactive par le propriétaire. Sauvegarde production toujours BLOCKED. Installation locale Yarn interrompue après erreurs réseau répétées ; remplacement par l’artefact CI vérifié, sans modification du lockfile.
