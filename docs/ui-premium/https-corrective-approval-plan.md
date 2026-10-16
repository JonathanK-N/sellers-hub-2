# Approbation corrective — Dynamic Premium HTTPS

Auteur : Jonathan Kakesa (JonathanK-N). 15 octobre 2026, heure client America/Toronto.

## Défaut réel et candidat

Les sept audits HTTPS du Web 4e28a3d et de l’API 2806 sont conservés dans https-lighthouse-ci-loop1.json. Quatre LCP échouent : Produits3038 ms, Panier2993 ms, Messagerie3156 ms, Vendeur3146 ms. Le statut reste NO-GO.

Candidat exact **838cc9523267be74561edd9b395d46615b2fad0a**, branche codex/afrimarket-dynamic-https-evidence, PR10 https://github.com/JonathanK-N/sellers-hub-2/pull/10. CI38832186336 :12 jobs SUCCESS.27 contrôlesUI dans trois moteurs, tests de transport natif, trois audits publics de preview PASS. Les empreintes de deux ZIP et les163 fichiers internes de l’artefactWeb ont été vérifiés ; sourceSha838cc952 et buildSha6df1a1792537dfba1d29b99f7725993c824ff838 distingués.

Le correctif lance GET /auth/me sans attendre Axios, sans cookie et avec cache no-store ; gardes de rôles conservées. La régression bloque le chunk Axios et exige une session vérifiée avant de le libérer. Aucun changement backend, schéma, index, seed, compte ou donnée. Le cache reste Dynamicv14 ; la politique privée du worker est inchangée. La version de base embarquée reste1.1.0-direct-rc.4 : c’est le SHA Web qui identifie ce correctif.

## Diff Railway soumis, non appliqué

Projet AFRIMARKET-STAGING-20261010 : bc40e22f-b963-46fa-a64e-240f3aa954cd. Environnement staging :0fea37a0-e334-4963-952e-d99ca7523ffd. Compte choisi :Primary. Une seule ressource, afrimarket-web-staging :5a36eb00-531d-4aae-be1a-f8c63f241da3.

| Champ | Avant | Après |
|---|---|---|
| source.branch | feature/afrimarket-ui-dynamic-premium | codex/afrimarket-dynamic-https-evidence |
| source.commitSha | 0118ebd affiché en configuration,4e28a3d réellement exécuté | 838cc9523267be74561edd9b395d46615b2fad0a épinglé |

Conserver dépôt JonathanK-N/sellers-hub-2,/frontend,RAILPACK,yarn serve,healthcheck/,port8080,domaineHTTPS,us-west2,1réplica et REACT_APP_BACKEND_URL. Aucun nouveau service, volume, variable, secret, domaine ou changement de capacité. Brève indisponibilité possible lors du remplacement du Web.

API : conserver déploiement1a774143-96db-4cb8-a0be-19116988a51f au SHA2806d719bf0edbdc31ebd32ab0887e1fb4dc40cb. Ne pas redémarrer l’API : son startup sandbox effectue un seed incompatible avec la mission. Mongo : conserver déploiementa72b1bb3-5a19-4049-b1fe-e1067ae6cd3f et volume b0f66ec2-2328-4b12-aecb-47847c6d5733,1024MB,/data/db. Production et PR8/9 intactes.

## Application après accord seulement

Relire l’environnement : aucun patch supplémentaire ne doit être en attente. Stager la source du seul Web avec staged=true et les IDs exacts ; repo/branche/SHA ci-dessus. Relire le diff et exiger seulement les deux champs autorisés,destructive=false. Soumettre accept-deploy puis attendre la décision sans autre tâche. En cas d’annulation du contrôle intégré, arrêter ; aucun contournement CLI/API/UI. Le propriétaire pourra appliquer directement le patch relu dans le dashboard. Ne pas utiliser Deploy Latest Commit ; le SHA applicatif reste838cc952 même si des commits de preuves existent ensuite.

## Contrôles obligatoires après application

Exiger WebSUCCESS avec commitHash838cc952, puis vérifier HTTPS/JS/worker. API et Mongo doivent conserver les déploiements ci-dessus. Réexécuter les contrôles de rôles, session invalide, permissions403/401, panier local, lecture commandes et conversations, consentementWhatsApp sans envoi, responsive et reduced-motion, caches privés et horsligne.

Réexécuter les sept audits HTTPS à froid avec sessions existantes temporaires : accueil,produits,panier,commandes,messagerie,vendeur,administration. Conserver chaque passage et ses seuils ; aucune garantie de réussite après ce correctif. Perf≥90,LCP≤2500 ms,TBT<200 ms,CLS<0,1,A11y/BP≥95,SEOpublic≥95 ; privé non indexable. Les métadonnées des outils de mesure et du Web déployé doivent être distinctes.

Si un nouvel échec est confirmé, diagnostiquer,corriger,tester puis présenter une nouvelle approbation. Tout rollback Railway serait également soumis à accord distinct ; aucun changement Mongo ni restauration de données n’est prévu.

Les scénarios de créationcommande,paiementdéclaré ou envoimessage restent BLOCKED par l’interdiction d’écrire. Les scores de preview ne valent pas validationHTTPS. Aucune préparation ou application de production avant validation complète.
