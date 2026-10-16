# Validation HTTPS du correctif WhatsApp — Web staging uniquement

Auteur : Jonathan Kakesa (JonathanK-N). Date : 16 octobre 2026.

## Proposition nécessitant une approbation distincte

Projet AFRIMARKET-STAGING-20261010 : bc40e22f-b963-46fa-a64e-240f3aa954cd. Environnement staging : 0fea37a0-e334-4963-952e-d99ca7523ffd. Connexion Primary. Seul service : afrimarket-web-staging, 5a36eb00-531d-4aae-be1a-f8c63f241da3.

Deux champs source uniquement : branche actuelle vers fix/whatsapp-contact-configuration ; commitSha actuel 6606024e027ed163e697100ed83b8ff3475785ac vers 39c8f6404204efa2dc17e17dda0b8e3ccefde895. Conserver repo JonathanK-N/sellers-hub-2, racine /frontend, RAILPACK/V3, yarn serve, healthcheck /, port 8080, une réplique us-west2 et REACT_APP_BACKEND_URL.

Pas de changement API, MongoDB, volume, variables, secrets, données ou production. Aucune fusion de PR. Aucun seed ou migration. La branche candidate reste figée ; les preuves sont sur la branche documentaire séparée docs/whatsapp-contact-validation.

## Éléments vérifiés et limite

Candidat : 174 fichiers compilés vérifiés, 11 scénarios WhatsApp PASS, 28 scénarios UI PASS. Le job UI/performance reste FAIL : LCP de prévisualisation 2834 / 2716 / 2715 ms pour un seuil inchangé de 2500 ms. Ce déploiement est proposé pour vérifier réellement le correctif fonctionnel sur HTTPS staging ; aucun GO production ni réussite de performance n’est annoncé. Preuves et historique conservés dans whatsapp-correction-report.md et whatsapp-candidate-ci.json.

Après accord : relire l’état et confirmer aucun autre patch ; stager les deux champs Web seuls, inspecter le diff non destructif, soumettre au contrôle Railway et attendre sans travail parallèle. Ne contourner aucun refus.

Après application : vérifier SUCCESS et SHA réel exact ; comparer le bundle, healthchecks et état inchangé API/Mongo. Contrôler les liens boutique/produit à partir des seules fixtures staging existantes, sans envoyer de message, SMS, commande ou paiement ni écrire dans la base. Ne pas activer de contact sur un compte de production. Les cas de publication/OTP/révocation sont validés uniquement contre les fixtures interceptées et le Mongo synthétique CI.

La production nécessitera ensuite une approbation distincte. Les vendeurs réels doivent toujours publier et vérifier leur numéro ; le correctif ne publie pas d’ancien numéro automatiquement.
