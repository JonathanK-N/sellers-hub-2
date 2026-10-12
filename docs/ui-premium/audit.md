# Audit initial — interfaces premium AfriMarket

Auteur : Jonathan Kakesa (JonathanK-N).

Base commune : `2806d719bf0edbdc31ebd32ab0887e1fb4dc40cb` (rc.4), descendant de rc.3 `ddbbaabc01dda497d05ee3372f41a12503f4fddd`, rc.2 `cd248cacb084e357c7affb6f530f6f168274cd1d` et rc.1 `c492c70126a2ec9da71844c2d313df8e675c2ffb`. Aucune fusion : les PR 1 à 7 restent ouvertes. Les PR 4 à 7 ciblent main, qui ne contient pas les dernières corrections. Cette base conserve ces corrections et ses onze jobs CI passent, mais les seuils de performance HTTPS ne sont pas certifiés.

Railway staging API et Web sont SUCCESS au SHA rc.4 après intervention du propriétaire (déploiements consignés dans le tableau ci-dessous). Les captures baseline sont renouvelées après ce changement, avec provenance SHA, hash du JavaScript et heure. Aucun appel de mutation Railway ni changement Mongo, volume, secrets ou production.

| Service | Déploiement observé |
|---|---|
| API staging | 1a774143-96db-4cb8-a0be-19116988a51f |
| Web staging | e57a0e25-5dcf-4365-967f-a67f345e6ef1 |

Architecture : React 19, React Router 7, Vite 8, Tailwind 4, CSS local, Axios avec token et expiration 401. Routes privées vérifiées par ProtectedRoute ; auth modal chargé à la demande ; worker public exclut requêtes API et Authorization. Règles financières directes conservées, aucune modification backend.

Fonctions existantes : catalogue /products (country_code, category, q), produits /explore/product/:id, boutiques /explore/shop/:sellerId et API publique /seller/public/:id, tiroir panier et rôles buyer/seller/admin/deliverer. La route livreur réelle est /livreur. Les favoris existants sont désactivés et aucune API favorite ni inventaire public général des boutiques n’est exposé. La nouvelle sélection de favoris conserve uniquement des IDs de produits publics sur cet appareil ; elle ne revendique pas une synchronisation serveur. Les boutiques sont obtenues depuis les vendeurs des produits sélectionnés ; seul badge_verified justifie une mention de vérification.

Références : proposition 2 prioritaire immersive, proposition 1 éditoriale/crème, seconde image pour densité marketplace mobile. Conservation de la palette verte historique, images AVIF existantes, prix/dévises issus des helpers métier. Aucune promotion, note, badge, garantie, réseau social ni adresse de contact fictifs. Aucun prix décoratif. Les boutiques sans image restent explicitement sans photo. Liens légaux absents du dépôt : aucune page légale fictive.

Risques de régression : session périmée, rôle vendeur/livreur, panier invité, réponse filtre obsolète, XSS via nom de produit, stockage local indisponible, favoris hors filtre, menu clavier/focus, overflow à 320 px, cache précédent. Mesures : API conservées, état request actif, React échappe les chaînes, consentement WhatsApp et paiement restent dans les pages existantes, menu dialog avec Escape et cycle Tab, cache distinct v14 par branche, tests d’états succès/erreur/vide et grille responsive.

Branches indépendantes : feature/afrimarket-ui-dynamic-premium et feature/afrimarket-ui-elegant-premium, même parent exact rc.4. Aperçus locaux uniquement. Aucun déploiement partagé, aucune PR fusionnée. Tests à exécuter : dix largeurs demandées, clavier/tactile, moteur Chromium puis Firefox/WebKit disponibles, catalogue et favoris, recherche/catégories, auth/panier/rôles, erreur et retry, PWA v13 vers v14, Lighthouse froid. Des fixtures explicites en tests peuvent illustrer les états sans aucune écriture dans les bases existantes ; elles ne sont jamais intégrées aux données d’affichage de production.

Blocages initiaux conservés : première capture a dépassé la durée du runtime, puis le script dédié a réussi ; premier yarn frozen-lockfile a échoué par ESOCKETTIMEDOUT sur lucide-react. Réessai sérialisé en cours ; CI/build distant utilisé si nécessaire, sans affaiblir les checks.
