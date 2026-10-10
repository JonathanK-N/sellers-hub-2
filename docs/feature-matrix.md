# Matrice fonctionnelle — périmètre réellement testé

Auteur : Jonathan Kakesa (JonathanK-N). Les PASS portent uniquement sur l’opération indiquée. Une lecture ne certifie pas les mutations ni le parcours complet. Preuves : staging-integration.json, staging-admin-validation.json, pwa-cart-validation.json et CI 38087694857.

## Acheteurs

| Fonction | Résultat et portée |
|---|---|
| Inscription et connexion | PASS — inscription, OTP et login API synthétiques |
| Recherche et filtres | BLOCKED — lecture produits seulement, filtres complets non certifiés |
| Consultation des produits | PASS — fiche utilisée pour ajout panier ; détails étendus non certifiés |
| Panier | PASS — ajout authentifié, contenu drawer et navigation checkout |
| Commandes | PASS — création retrait cash synthétique et rejet quantité nulle ; cycle complet BLOCKED |
| Paiements | BLOCKED — aucun paiement réel, sandbox externe non configuré |
| Historique | PASS — lecture API |
| Profil | PASS — lecture API ; modification complète BLOCKED |
| Notifications | PASS — lecture et notification commande synthétique |
| Messagerie | PASS — envoi acheteur et réception conversation vendeur |
| Réclamations et litiges | BLOCKED — parcours complet non testé |

## Vendeurs

| Fonction | Résultat et portée |
|---|---|
| Inscription | PASS — inscription, OTP et login API |
| Configuration de boutique | PASS — configuration et lecture synthétiques |
| Gestion des produits | PASS — création ; édition/suppression et uploads BLOCKED |
| Gestion des commandes | BLOCKED — lecture admin et création acheteur seulement |
| Tableau de bord | PASS — lecture API |
| Portefeuille | PASS — lecture ; opérations financières BLOCKED |
| Vérification KYC | BLOCKED — lecture statut PASS, upload et validation non certifiés |
| Abonnements premium | NOT IMPLEMENTED — paiement premium désactivé dans interface actuelle |

## Livreurs

| Fonction | Résultat et portée |
|---|---|
| Inscription | PASS — inscription, OTP, login API |
| Validation du compte | BLOCKED — parcours validation non testé |
| Tableau de bord | BLOCKED — non testé |
| Livraisons | BLOCKED — parcours complet non testé |
| Statuts des commandes | BLOCKED — transitions métier non certifiées |

## Administrateurs

| Fonction | Résultat et portée |
|---|---|
| Authentification | PASS — login synthétique |
| Gestion des utilisateurs | PASS — lecture ; mutations BLOCKED |
| Gestion des vendeurs | PASS — lecture ; mutations BLOCKED |
| Gestion des produits | PASS — lecture ; mutations BLOCKED |
| Validation KYC | BLOCKED — files en lecture PASS, validation non testée |
| Litiges | BLOCKED — non testé |
| Détection de fraude | BLOCKED — non testé |
| Gestion des livreurs | BLOCKED — non testé |
| Paramètres géographiques | BLOCKED — lecture publique pays PASS, configuration non testée |
| Supervision des commandes | PASS — liste ; actions métier BLOCKED |

## Backend

| Fonction | Résultat et portée |
|---|---|
| Endpoints | PASS — endpoints consignés ; couverture exhaustive BLOCKED |
| Authentification et autorisations | PASS — trois rôles, admin, refus acheteur admin ; matrice exhaustive BLOCKED |
| Validation des données | PASS — neuf tests santé/modèles et quantité nulle 422 ; validation globale BLOCKED |
| Gestion des erreurs | PASS — santé et rejet validation ; couverture globale BLOCKED |
| Journalisation | PASS — logs build/deploy inspectés ; audit de rétention BLOCKED |
| Connexion MongoDB | PASS — santé et écritures synthétiques staging |
| Tâches planifiées | BLOCKED — non certifiées |
| Transactions et cohérence des données | BLOCKED — concurrence, rollback transaction et flux financiers non certifiés |
