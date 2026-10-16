# Approbation corrective Web staging — Dynamic Premium

Auteur : Jonathan Kakesa (JonathanK-N).

État : proposition préparée, aucun changement Railway soumis ou appliqué. Staging NO-GO ; production interdite à ce stade.

Projet AFRIMARKET-STAGING-20261010 : bc40e22f-b963-46fa-a64e-240f3aa954cd. Environnement staging : 0fea37a0-e334-4963-952e-d99ca7523ffd. Connexion Primary.

Seul service concerné : afrimarket-web-staging, 5a36eb00-531d-4aae-be1a-f8c63f241da3.

| Champ source | Configuration actuelle | Proposition |
|---|---|---|
| branch | codex/afrimarket-dynamic-https-evidence | codex/afrimarket-dynamic-postdeploy-validation |
| commitSha | 838cc9523267be74561edd9b395d46615b2fad0a | 6606024e027ed163e697100ed83b8ff3475785ac |

Conserver repo JonathanK-N/sellers-hub-2, racine /frontend, RAILPACK/V3, démarrage yarn serve, healthcheck /, port 8080, runtime V2 et une réplique us-west2. Conserver REACT_APP_BACKEND_URL existant, sans lire ou recopier de secret. Aucun autre champ, aucune variable à changer.

Le Web actuellement exécuté est 584f0c463ee53e65be790526cb38819eb8d6dd83, déploiement ce6b813b-f779-41f9-b8e9-e4564b8bd127 SUCCESS. Son application est identique à 838cc952 ; la différence documentaire est enregistrée dans le rapport. Ne jamais considérer le champ épinglé comme preuve de SHA réellement exécuté.

## Vérifications avant et après

1. Avant application : confirmer que la branche candidate pointe exactement sur 6606024e027ed163e697100ed83b8ff3475785ac et que les douze jobs CI sont réussis. Vérifier le diff Railway : uniquement les deux champs ci-dessus, aucune suppression ni création. Si un autre changement est présent, arrêter.
2. Après accord explicite, soumettre au contrôle intégré Railway ; attendre sa décision sans autre tâche. Aucun contournement CLI/API/tableau de bord automatisé en cas de refus. Une intervention manuelle du propriétaire peut être proposée si nécessaire.
3. Attendre le statut SUCCESS ; contrôler le commit réel dans les métadonnées du déploiement et le bundle HTTPS contre l’artefact vérifié. Vérifier healthcheck / et API /api/health.
4. Confirmer API et Mongo sans nouveau déploiement, volume b0f66ec2-2328-4b12-aecb-47847c6d5733 inchangé, aucun patch résiduel.
5. Refaire les sept audits HTTPS froids, sessions/permissions/PWA et contrôles métier en lecture seule. Aucune écriture, migration, seed, commande, paiement ou message réel. Aucune fusion des PR 8, 9, 10, 11.

Le correctif partage le préchargement des écrans avec leur montage et anticipe uniquement les modules de la route initiale. Il ne garantit pas le passage du seuil LCP : quatre pages privées restent en échec sur la version actuellement déployée et l’accueil varie entre les deux séries. Les seuils restent inchangés.

## Retour arrière

Si nécessaire, préparer un retour Web seul au SHA applicatif 838cc9523267be74561edd9b395d46615b2fad0a ou au déploiement actuel vérifié, avec une nouvelle approbation Railway. Ne pas redéployer le backend : démarrage sandbox avec seed. Aucun changement Mongo ou production.

Preuves : corrective-https-validation-report.md et postdeploy-candidate-ci.json. Branche candidate figée ; les preuves documentaires seront publiées séparément pour éviter un déploiement involontaire du HEAD documentaire.
