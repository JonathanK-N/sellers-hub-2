# Validation réelle du staging rc.2

Auteur : Jonathan Kakesa (JonathanK-N). 12 octobre 2026.

**Décision : staging non validé, production NO-GO.** API/Web exécutent réellement cd248cacb084e357c7affb6f530f6f168274cd1d, version 1.1.0-direct-rc.2. Le déploiement manuel est confirmé par Railway, le healthcheck et la ressource principale du build Web vérifié.

## Déploiements et conservation

API : 8d4360de-d7c4-4340-82f8-c74b659a4a11 SUCCESS ; Web : afe9e2d8-d360-44c9-a951-e8fa2dae012a SUCCESS. Mongo reste a72b1bb3-5a19-4049-b1fe-e1067ae6cd3f avec volume b0f66ec2-2328-4b12-aecb-47847c6d5733, 1024 MB, /data/db, sans patch en attente, domaine public ou proxy TCP. Aucun changement de configuration, volume, secret ou redémarrage Mongo effectué. Les seuls changements de données sont les fixtures TEST explicitement nécessaires aux parcours API ; aucun document client supprimé. Aucune lecture, modification ou fusion de production effectuée.

Le healthcheck répond 200, status ok, mongodb ok et SHA exact. FX no_data est conservé dans la preuve ; les commandes test utilisent leur montant natif FC, sans affirmer une conversion monétaire réelle. Les logs examinés ne montrent pas de traceback ; les lignes INFO de jobs planifiés sont classées « error » par le flux stderr Railway et ne doivent pas être interprétées comme des exceptions métier. La consultation de logs est un échantillon, pas une garantie sur tout l’historique.

## Contrôles réussis

- 24 parcours métier HTTPS : comptes dédiés, OTP sandbox, login navigateur, panier, commandes directes, réception avec consentement explicite, préparation, remise et livraison sans crédit financier, médiation sans remboursement, chat XSS littéral, rejeu après perte de réponse, reconnexion, pagination et expiration de JWT.
- 21 contrôles de sécurité/droits : absence de password_hash/otp_code/otp_expires_at et preuves WhatsApp dans les listes administratives, /auth/me et vendeur public ; refus anonyme et par rôle, conversation inaccessible au livreur, limites de texte/cursor, CORS, checkout et annulation idempotents, paiement prestataire non vérifié/sans fonds détenus, retrait et webhook désactivés, retrait du consentement WhatsApp masquant le contact puis restauration de la configuration du seul vendeur TEST.
- 7 contrôles PWA sur HTTPS réel : v11 actif, ancien cache v10 supprimé, cache tiers conservé, session valide en ligne, API et requêtes autorisées absentes du cache, API privée hors ligne 503, session effacée redirigée au login.
- 6 contrôles complémentaires sur l’artefact exact : ancien worker rc.1 réellement actif puis migration v10 vers v11, rendu visité hors ligne, API sans faux succès, fallback lisible d’un écran non caché et récupération après reconnexion.

Les preuves OTP de vérification ne sont pas exposées dans les réponses examinées. Le champ otp_dev du seul parcours sandbox reste volontairement utilisé en mémoire pour les fixtures ; ces tests ne certifient ni l’envoi SMS réel ni un mode d’authentification de production. Aucun envoi réel WhatsApp, SMS ou paiement prestataire.

## Deux audits HTTPS à froid — échecs conservés

Lighthouse 13.5, profil mobile par défaut inchangé, navigateur neuf par page, sessions initialisées sur robots.txt sans charger le bundle applicatif. Les pages privées restent non indexables ; seuil SEO >=95 réservé aux pages publiques. Le seuil de performance est >=90, accessibilité et bonnes pratiques >=95, LCP <=2500 ms, TBT <200 ms et CLS <0.1.

| Page | Performance cycle 1 / 2 | Accessibilité cycle 1 | LCP cycle 1 / 2 (ms) | TBT cycle 1 / 2 (ms) | Décision |
|---|---|---|---|---|---|
| Accueil | 75 / 89 | 100 | 2979 / 2903 | 662 / 195 | FAIL |
| Produits | 94 / 96 | 100 | 2874 / 2653 | 15 / 0 | FAIL |
| Panier | 96 / 96 | 100 | 2685 / 2645 | 0 / 0 | FAIL |
| Commandes | 98 / 98 | 95 | 2063 / 1998 | 0 / 0 | PASS |
| Messagerie | 96 / 96 | 100 | 2681 / 2655 | 0 / 0 | FAIL |
| Vendeur | 95 / 96 | 100 | 2693 / 2674 | 0 / 0 | FAIL |
| Administration | 98 / 98 | 100 | 2056 / 1999 | 0 / 0 | PASS |

Bonnes pratiques 100 et CLS <0.1 sur les sept pages. Les scores variables de l’accueil ne remplacent pas son échec au seuil ; aucun résultat n’est sélectionné pour masquer le premier cycle.

## Diagnostic et correctif préparé, non déployé

Le second audit conserve uniquement les métriques et URLs de ressources statiques, sans contenu de page privée. Sur l’accueil, l’élément LCP est une image : téléchargement commencé tôt (~186 ms), terminé ~267 ms, retard de rendu observé ~2060 ms. Le TTFB observé ~154 ms et le téléchargement de l’image ~81 ms ne suffisent pas à expliquer seuls ce retard. Les sous-parties observées ne doivent pas être additionnées aux scores simulés comme si elles utilisaient la même chronologie.

Sur les produits, le LCP est un titre : bundle initial ~121 Ko transférés, puis fichiers d’écran vers ~465 ms. L’image d’accueil ~47 Ko est aussi préchargée sur cette page qui ne l’utilise pas. La source importe QueryClientProvider uniquement à la racine ; aucun écran n’utilise ses hooks. Les écrans privés sont chargés après validation de session, créant une chaîne de requêtes évitable.

La branche isolée codex/afrimarket-rc2-lcp prépare trois modifications : retirer le fournisseur inutilisé du bundle, précharger l’image uniquement sur / et télécharger les fichiers d’écran ciblés en parallèle avec la validation de session. Les écrans ne sont pas rendus avant les gardes d’accès. Le gain reste à mesurer ; il n’est pas déclaré acquis. Version corrective préparée rc.3, Android code 7 et cache v12 pour garantir une nouvelle activation PWA. Aucun tag existant déplacé.

Un audit local de diagnostic est resté bloqué avant de produire des rapports et son seul processus identifié a été arrêté. Il n’est pas utilisé comme preuve de performance.

## Preuves et accès temporaires

Dans release-evidence : staging-rc2-deployment-verification.json, staging-https-rc2-business-loop1.json, staging-https-rc2-security-loop2.json, staging-rc2-pwa-https-loop1.json, staging-rc2-pwa-upgrade.json, staging-rc2-lighthouse-ci-cold-loop1.json et staging-rc2-lighthouse-ci-diagnostic-loop2.json. Les premiers essais du harness sur routes/schéma incorrects restent conservés et identifiés comme diagnostics, sans être assimilés à des failles applicatives.

Les artefacts GitHub sont vérifiés par digest SHA-256. Les rapports bruts et sessions restent hors Git dans le répertoire privé. Les trois secrets GitHub QA de 45 minutes ont été supprimés après chaque audit. Aucune nouvelle clé SSH ni secret de signature transféré.

Prochaine étape : CI complète et artefact exact du correctif, puis approbation distincte avant application API/Web staging. Refaire les validations HTTPS et à froid après application. Ne préparer aucun GO production tant que les sept pages et tous les contrôles obligatoires ne passent pas.
