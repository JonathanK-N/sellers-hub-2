# Proposition corrective Web staging — isolation du code initial

Auteur : Jonathan Kakesa (JonathanK-N). Date : 16 octobre 2026.

Le staging 6606024 reste NO-GO. Aucun déploiement de production proposé tant que les critères HTTPS ne sont pas satisfaits. La demande de production du propriétaire est enregistrée ; elle ne transforme pas un échec de performance en GO.

Projet AFRIMARKET-STAGING-20261010 / bc40e22f-b963-46fa-a64e-240f3aa954cd. Environnement staging / 0fea37a0-e334-4963-952e-d99ca7523ffd. Service existant afrimarket-web-staging / 5a36eb00-531d-4aae-be1a-f8c63f241da3, connexion Primary.

## DIFF NON SOUMIS — CANDIDAT REFUSÉ PAR LA VALIDATION CI

| Champ source | Actuel | Nouveau |
|---|---|---|
| branch | codex/afrimarket-dynamic-postdeploy-validation | codex/afrimarket-route-entry-budget |
| commitSha | 6606024e027ed163e697100ed83b8ff3475785ac | f80223e4d0bb946c2f556009442f59c94455e9ba |

Conserver dépôt JonathanK-N/sellers-hub-2, racine /frontend, RAILPACK, yarn serve, healthcheck /, port 8080, région us-west2, réplique unique, REACT_APP_BACKEND_URL et tous les autres paramètres. Aucun changement API, MongoDB, volume, secrets, données ou production ; aucune fusion.

## Justification et échecs conservés

Le Web 6606024 est SUCCESS (déploiement 62b1a5f8-a450-4611-823b-f2cb98b663a1) mais ses sept LCP HTTPS dépassent 2500 ms. Voir 660-https-validation-report.md. La vérification native de session, le panier local, les permissions, le responsive et la migration PWA v13 vers v14 passent dans la limite de tests sans écriture. Commandes, messages et paiements réels ne sont pas exécutés.

Le premier essai eb59561399e8cf35f4032b39b16f3b35362d57b6 réduit le bundle initial gzip de 95869 à 89181 octets, mais introduit une suspension au montage public. Ses 28 contrôles UI passent ; ses trois LCP publics locaux de CI échouent à 2711,4 / 2707,8 / 2707,3 ms. Preuve intacte : entry-budget-preview-failed.json, run 38848337379.

Le candidat f80223e attend la résolution du module public avant le premier montage de l’accueil, en conservant le démarrage immédiat des routes privées pour la vérification de session. Il isole le code de la marketplace publique des routes privées et garde son CSS dans le chargement initial. Il ne garantit pas les sept LCP HTTPS : une nouvelle mesure réelle est indispensable. CI et artefacts : entry-budget-candidate-ci.json, PR12 indépendante.

## Application et vérifications

1. Confirmer que la branche candidate reste exactement à f80223e4d0bb946c2f556009442f59c94455e9ba et que les douze jobs CI sont réussis. Les preuves documentaires restent sur une branche distincte codex/afrimarket-entry-budget-evidence.
2. Après accord distinct, préparer uniquement ces deux champs et vérifier le patch non destructif. Arrêter si un autre changement apparaît. Soumettre au contrôle intégré Railway et attendre sa décision, sans activité parallèle ni contournement en cas de refus.
3. Après application, vérifier SUCCESS, le SHA réel et les octets HTTPS contre l’artefact exact, healthchecks Web/API, puis API/Mongo sans nouveau déploiement et volume inchangé.
4. Refaire sept audits froids et les contrôles fonctionnels en lecture seule, avec seuils inchangés et conservation des échecs. Aucun GO production présumé.
5. Un retour arrière éventuel au Web 6606024 exigerait lui aussi une approbation Railway distincte. Ne pas redémarrer le backend sandbox qui effectue un seed au démarrage.

## Blocage final

NE PAS APPLIQUER CE PLAN. Le candidat f80223e échoue aux trois audits publics de CI : LCP 4660,5 / 2558,2 / 2553,0 ms, performance 49 / 95 / 96, TBT 972 / 30 / 30 ms. Les 28 contrôles UI passent mais ne remplacent pas le seuil de performance. Aucune demande d’approbation Railway soumise pour ce candidat. Preuves : entry-budget-candidate-ci.json.
