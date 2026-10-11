# Phase 2 — matrice fonctionnelle

Auteur : Jonathan Kakesa (JonathanK-N). Données exclusivement synthétiques, API staging isolée.

Les PASS HTTP ci-dessous attestent les réponses et états contrôlés ; ils ne signifient pas que chaque parcours a été exécuté visuellement ni sur téléphone physique.

| Parcours/contrôle | Résultat | Preuve / limite |
|---|---|---|
| Acheteur : inscription, OTP sandbox, login | PASS | `auth-http-loop4.json`, 3 contrôles |
| Livreur : inscription, OTP sandbox, login | PASS | Même fichier, 3 contrôles |
| Vendeur : inscription, OTP sandbox, login, boutique | PASS | `seller-registration.json`, 4 contrôles |
| Vendeur : boutique configurée, création/édition produit et stock | PASS | `commerce-http-current.json` |
| Acheteur : consultation et recherche produit | PASS | Produit créé puis prix 125/stock 4 vérifiés, recherche par nom |
| Acheteur : ajout panier, augmentation/diminution de quantité | PASS | `pwa-cart-current.json`, navigateur mobile 390 px |
| Panier : total recalculé et route panier | PASS | Même preuve, total modifié puis restauré |
| Commande : calcul prix et commission côté serveur | PASS | Prix 125, commission 8,75 ; injection montant ignorée dans loop2 |
| Quantités 0/-1, stock insuffisant, lignes dupliquées | PASS | `commerce-http-loop2.json`, tests MongoDB réels |
| Commandes concurrentes et compensation d’échec ordinaire | PASS | Tests `test_commerce_mongo.py` et `test_stock_unit.py` |
| Paiement cash : initialisation et répétition après libération | PASS | loop2, escrow released préservé |
| Vendeur : traitement préparation/retrait | PASS | loop2, preparing puis ready_for_pickup |
| Vendeur : attribution au livreur | PASS | commerce actuel |
| Livreur : assignment, picked-up et en-route | PASS | commerce actuel ; pas un contrat d’acceptation dédié supplémentaire |
| Livreur : code invalide, confirmation prématurée et doublon | PASS | Réponses 400/409 vérifiées |
| Livreur : confirmation cash et état delivered/released | PASS | commerce actuel |
| Acheteur : confirmation livraison cash | PASS | loop2 ; répétition refusée |
| Notifications dans l’application | PASS | Notice de la commande présente dans le feed acheteur |
| Notifications SMS/FCM externes | BLOCKED | Aucune configuration staging fournisseur copiée depuis production |
| Groupe/commande : accès livreur non affecté | PASS | HTTP 403, `order-read-security-after.json` |
| Accès admin et édition produit par acheteur | PASS | Refus 403 ; administration authentifiée 200 |
| Admin : dashboards overview/vendeurs/commandes/KYC en attente/fraude et permissions | PASS | `admin-wallet-http.json`, 12 contrôles ; lecture seule |
| Portefeuille vendeur : aperçu et transactions | PASS | Même fichier, 2 contrôles |
| Recherche publique : route, query et liens produit | PASS | `browser-final/browser-validation.json` |
| Recherche caractères spéciaux / longueur | PASS | `search-security-after.json` et test MongoDB réel |
| Admin : gestion exhaustive vendeurs/fraude/KYC | BLOCKED | Contrôles de rôle partiels ; stockage KYC et tests métier complets absents |
| Litige : ouverture, résolution interne et seconde résolution | PASS | `disputes-http.json`, 5 contrôles internes/permissions |
| Remboursement partiel | BLOCKED | Suspendu explicitement jusqu’à définition frais/commission ; refus 503 PASS |
| Remboursement externe | NOT IMPLEMENTED | Le test comptable interne n’appelle pas le fournisseur |
| Paiement Mobile Money fournisseur sandbox | BLOCKED | Identifiants/contrat de sandbox absents ; refus fermé 503 PASS |
| Paiement refusé/replay de webhook réel | BLOCKED | Unit tests de gardes PASS ; certification fournisseur non exécutée |
| Portefeuille vendeur/retrait sur replica set | PASS | 20 demandes concurrentes, solde disponible réservé sans dépassement en Mongo réel |
| Retrait positif sur staging standalone | BLOCKED | Topologie sans transactions ; 503 sans modification de solde vérifié |
| Double confirmation crédit livreur | PASS | CAS refuse le perdant avant crédit ; tests privacy |
| Reprise financière après crash entre collections | FAIL | Atomicité durable non garantie sur commandes/litiges/ledger |
| Session : déconnexion temporaire | PASS | `offline-session-current.json`, token/user conservés |
| Session : token rejeté 401 | PASS | `session-rejection-current.json`, token/user effacés et login |
| Erreur API hors ligne | PASS | PWA API 503, pas de succès privé provenant du cache |
| Favoris | NOT IMPLEMENTED | Bouton désactivé et libellé explicite |

Tests reproductibles : `scripts/commerce_staging_validation.cjs`, `scripts/pwa_cart_validation.cjs`, `scripts/pwa_upgrade_validation.cjs`, tests backend de la CI. Les scripts HTTP de staging utilisent uniquement les fichiers de credentials synthétiques situés hors dépôt ; ils n’affichent ni tokens, ni mots de passe, ni codes de remise.
