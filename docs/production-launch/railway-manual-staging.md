# Application manuelle du staging AfriMarket

Auteur : Jonathan Kakesa (JonathanK-N). Vérification du 12 octobre 2026.

## 1. Diagnostic établi

Le connecteur Railway lit correctement le projet, les services et le patch sous Jonathan Kakesa (@jonathank-n). Le réglage spécifique « Allow read actions » est enregistré : lecture sans demande, modifications avec demande. Les anciennes annulations ne prouvent ni une expiration ni un refus volontaire. Leur seule réponse disponible est « Cancelled — the user did not approve this action. No changes were made. », sans journal d’approbation, statut d’affichage, décision horodatée, scopes OAuth ou rôle d’écriture courant. La cause précise reste NON CONFIRMÉE. Le changement de permission n’a pas résolu le problème.

Aucune nouvelle tentative d’application n’a été effectuée pour ce diagnostic. Aucun réglage global n’a été modifié. Les informations accessibles prouvent l’accès en lecture, pas l’autorisation effective de déployer. Le tableau de bord peut permettre de constater un rôle insuffisant ou un refus explicite ; relever alors uniquement le message, jamais un token ou mot de passe.

## 2. Identifier la bonne cible

Ouvrir [le projet staging](https://railway.com/project/bc40e22f-b963-46fa-a64e-240f3aa954cd), puis sélectionner **staging**. Vérifier les identifiants dans les paramètres si l’adresse ne sélectionne pas l’environnement.

| Ressource | Nom exact | Identifiant |
|---|---|---|
| Projet | AFRIMARKET-STAGING-20261010 | bc40e22f-b963-46fa-a64e-240f3aa954cd |
| Environnement | staging | 0fea37a0-e334-4963-952e-d99ca7523ffd |
| API existante | afrimarket-api-staging | 3a11fecf-70e7-4ba3-8744-d0156b9f7e6c |
| Web existant | afrimarket-web-staging | 5a36eb00-531d-4aae-be1a-f8c63f241da3 |
| Mongo existant | afrimarket-mongo-staging | 80a726a8-1cd5-4387-9e5d-8cd6c9671d9e |
| Volume préparé | afrimarket-mongo-staging-data | b0f66ec2-2328-4b12-aecb-47847c6d5733 |

Point de contrôle : trois services existants, aucune création de service, aucune opération sur le projet production 7cf04965-3d75-4965-9e76-cd33c3b716c5. Les secrets de production restent inchangés.

## 3. Conservation des données AVANT application

Le Mongo live est actuellement éphémère et sans volume. Le volume neuf monté sur /data/db ne copie pas automatiquement ses données. « destructive=false » décrit les changements d’infrastructure ; ce n’est pas une preuve de conservation des données de l’ancien conteneur.

Une régénération des fixtures synthétiques avait été autorisée précédemment. La nouvelle demande exige la conservation des données Mongo existantes : par prudence, **ne pas cliquer Deploy avant un export staging restaurable**, sauf clarification explicite du propriétaire permettant toujours la régénération. La sauvegarde production existante ne protège pas les données staging.

Pour préparer cet export sans exposer Mongo publiquement :

1. Ne pas redémarrer Mongo, ajouter de proxy TCP, modifier son image ou monter le volume avant sauvegarde.
2. Préparer l’accès SSH au service staging existant. Railway exige une clé SSH enregistrée. Dans le tableau de bord, utiliser la commande SSH copiée du service ; si aucune clé n’existe, en créer une localement avec phrase de passe et enregistrer **uniquement sa clé publique** dans le compte Railway. Ne jamais transmettre la clé privée ni sa phrase de passe dans le chat. Ne pas ajouter une clé donnant accès à tout le workspace si une clé personnelle suffit.
3. La CLI officielle déjà installée est C:\Users\Djibril\Documents\ChatGPT\Afrimarket-private-backups\railway-cli-5.64.2\railway.exe. La connexion SSH doit cibler exactement le projet/environnement/service ci-dessus. La connexion préalable avait échoué faute de clé locale ; aucune commande Mongo distante n’avait alors été exécutée.
4. Pour un service sans domaine, Railway fournit **Copy Service Instance ID** dans la palette du service. Cet identifiant d’instance SSH diffère du Service ID du tableau ci-dessus ; ne pas substituer l’un à l’autre. [Documentation SSH Railway](https://docs.railway.com/cli/ssh).
5. Une fois l’accès sécurisé prêt, l’export devra inventorier toutes les bases métier réellement présentes, sauvegarder de manière cohérente, chiffrer hors Git et restaurer dans un Mongo isolé. Comparer documents/IDs/indexes et vérifier que les écritures sont rétablies avant application. Ne pas utiliser une copie de /data/db sur un serveur actif comme preuve suffisante et ne pas afficher les documents dans le chat.
6. Conserver archive et clé séparées des artefacts de release. Après conversion, restaurer uniquement les anciennes données staging dans la base prévue, après contrôle de la cible et des conflits ; aucun seed de remplacement si la conservation stricte est requise. Ces opérations de backup/restauration staging ne sont pas encore exécutées ni certifiées.

Point de contrôle : preuve d’export/restauration staging disponible, ou clarification explicite de la régénération synthétique. Sans l’un de ces deux éléments, les paramètres peuvent être relus mais l’application reste arrêtée.

## 4. Relire le patch déjà préparé

Dans la bannière des changements en attente, ouvrir **Details**. Le [flux documenté Railway](https://docs.railway.com/deployments/staged-changes) présente la différence entre anciennes et nouvelles valeurs avant application.

Attendu : patch **6d13f9a6-4924-4c69-92e3-d351404d5136**, état STAGED, **24 modifications**. API : 11 changements ; Web : 4 ; Mongo : 7 ; volume neuf : 2 champs. Les lignes « Image removed » retirent le choix de l’ancienne source Docker pour utiliser le dépôt ; elles ne doivent pas supprimer le service. Aucune suppression de service/volume/bucket, aucun changement de réseau privé et aucune variable partagée.

Les trois services doivent indiquer :

```text
Repository: JonathanK-N/sellers-hub-2
Branch: release/afrimarket-production-launch
Pinned commit: c492c70126a2ec9da71844c2d313df8e675c2ffb
Candidate tag: v1.1.0-direct-rc.1
```

La branche contient ensuite des rapports/outils de diagnostic. **Ne pas sélectionner Deploy Latest Commit** : le candidat est épinglé au SHA ci-dessus. Ne pas recréer le patch, changer la branche ou reconnecter la source si les valeurs sont déjà correctes. Si l’interface ne montre pas le SHA épinglé, suspendre le clic et faire vérifier la source par le connecteur ; ne pas le remplacer silencieusement par la tête de branche.

Point de contrôle : les 24 changements correspondent à ce guide. Tout changement supplémentaire, suppression ou SHA différent doit être expliqué avant application.

## 5. Paramètres Mongo à vérifier

| Champ | Valeur attendue |
|---|---|
| Service | afrimarket-mongo-staging existant |
| Root Directory | racine du dépôt, pas /backend ni /frontend |
| Dockerfile Path | Dockerfile.mongodb-staging |
| Image construite | mongo:8.0.32 via ce Dockerfile |
| Start Command personnalisé | aucun ; conserver l’ENTRYPOINT du Dockerfile |
| Région/réplicas existants | us-west2, 1 |
| Volume | afrimarket-mongo-staging-data, 1024 MB, /data/db |
| MONGO_INITDB_ROOT_USERNAME | staging_root |
| MONGO_INITDB_ROOT_PASSWORD | conserver la valeur secrète existante |
| MONGO_APP_PASSWORD | conserver la seconde valeur secrète existante |

La présence des deux mots de passe distincts de 48 caractères a été revérifiée sans affichage. Ne pas les copier ici, les réinitialiser ou les remplacer par des exemples. Les variables sont standard, selon l’autorisation antérieure ; elles ne sont pas scellées. Ne pas modifier leur forme pendant cette application.

RAILWAY_PRIVATE_DOMAIN est fourni par Railway, pas à saisir manuellement. Le bootstrap crée afrimarket-staging-rs à un membre avec hostname privé, la clé interne dans /data/db, la base afrimarket_staging_synthetic et le compte afrimarket_staging limité à readWrite sur cette base. Aucun endpoint d’initialisation public ni nouveau proxy TCP.

Point de contrôle : volume attaché au bon service et bon chemin ; Dockerfile correct ; secrets présents ; aucune commande personnalisée court-circuitant le bootstrap.

## 6. Paramètres API à vérifier

| Champ | Valeur attendue |
|---|---|
| Root Directory | /backend |
| Builder | RAILPACK |
| Build Command conservée | PYTHONPATH=. python -m pytest tests/test_health_unit.py tests/test_models_unit.py -q |
| Démarrage | Procfile existant : uvicorn server:app --host 0.0.0.0 --port $PORT |
| Healthcheck | /api/health |
| Port du domaine existant | 8080 |
| Région/réplicas | us-west2, 1 |
| AUTH_MODE | sandbox |
| PAYMENT_MODE existant | sandbox |
| DB_NAME | afrimarket_staging_synthetic |
| SEED_DEMO | false |
| COMMERCE_CHECKOUT_MODE | direct |
| CINETPAY_ENABLED | false |
| LEGACY_FINANCIAL_ACTIONS_ENABLED | false |

Valeur de **référence**, sans mot de passe littéral, pour MONGO_URL :

```text
mongodb://afrimarket_staging:${{afrimarket-mongo-staging.MONGO_APP_PASSWORD}}@${{afrimarket-mongo-staging.RAILWAY_PRIVATE_DOMAIN}}:27017/afrimarket_staging_synthetic?authSource=afrimarket_staging_synthetic&replicaSet=afrimarket-staging-rs
```

Utiliser le texte de référence dans la variable ; ne pas copier l’URI résolue contenant le secret. Les [références Railway](https://docs.railway.com/variables/reference) utilisent le nom du service comme namespace. Conserver JWT_SECRET, ADMIN_PASSWORD, ADMIN_PHONE et ADMIN_NAME existants ; aucun secret production. CORS_ORIGINS doit autoriser l’origine https://afrimarket-web-staging-staging.up.railway.app ; conserver les autres origines locales autorisées sans ouvrir tous les domaines. Si cette correction devient nécessaire, elle ajoute un changement au patch : relire le nouveau diff avant application.

Point de contrôle : trois flags en attente avec les valeurs ci-dessus. Leur absence dans les variables **live** avant application est normale ; ne pas interpréter la lecture live comme leur perte dans le patch. L’API ne doit pas garder une URI Mongo anonyme après conversion.

## 7. Paramètres Web à vérifier

| Champ | Valeur attendue |
|---|---|
| Root Directory | /frontend |
| Builder | RAILPACK |
| Build | script existant yarn build ; Node >=20.19 requis par package.json |
| Start Command existante | yarn serve |
| Healthcheck | / |
| Port/région/réplicas | 8080, us-west2, 1 |
| REACT_APP_BACKEND_URL | https://afrimarket-api-staging-staging.up.railway.app |

Conserver le domaine https://afrimarket-web-staging-staging.up.railway.app. Ne pas utiliser afri-market.app, l’API production ou un domaine supplémentaire.

Point de contrôle : API staging dans les variables de build, SHA épinglé identique à Mongo/API. Le build Railway sera un nouveau build du même source ; ses hashes de bundles peuvent différer du ZIP CI selon les métadonnées d’environnement. Vérifier la provenance, pas seulement la ressemblance visuelle.

## 8. Application par le propriétaire

Une fois la conservation réglée et tous les contrôles précédents satisfaits, saisir un message tel que « AfriMarket staging v1.1.0-direct-rc.1 c492c701 — patch vérifié », puis cliquer **Deploy** dans la bannière du patch. Ne pas maintenir Alt : la documentation indique que cette combinaison peut enregistrer sans redéployer.

Ce clic applique ensemble les changements préparés ; il ne faut pas reconstruire trois services ou créer un nouveau projet. Une interruption staging pendant build/démarrage est attendue. Les références organisent certaines dépendances, mais ne prouvent pas que Mongo est déjà PRIMARY lorsque l’API démarre. Attendre les vrais statuts et logs.

Point de contrôle : une nouvelle activité et de nouveaux déploiements sont visibles. Si le tableau de bord refuse, conserver le message exact et vérifier le rôle dans le workspace/projet ; ne pas multiplier les clics, désactiver les permissions ou utiliser une autre cible.

## 9. Contrôles après application

1. **Mongo** : build sur c492c701, bootstrap « Authenticated staging replica set ready », volume monté, pas de boucle de crash. Les tests authentifiés doivent confirmer PRIMARY/setName, refus anonyme, compte applicatif limité, transactions et persistance. Ne pas lancer un redémarrage de validation avant sauvegarde/restauration des données à conserver.
2. **API** : nouveau déploiement SUCCESS sur c492c701. Ouvrir https://afrimarket-api-staging-staging.up.railway.app/api/health ; attendre version 1.1.0-direct-rc.1, source_sha exact, checks.mongodb=ok et status=ok. HTTP 200 seul ne suffit pas : le healthcheck peut répondre degraded dans son JSON. Un fx_rate=no_data sur une base vierge n’autorise pas un seed de remplacement.
3. **Flags** : https://afrimarket-api-staging-staging.up.railway.app/api/commerce/features doit indiquer direct_payment=true, funds_held_by_platform=false, cinetpay_enabled=false, wallet_withdrawals_enabled=false et direct_refunds_automatic=false.
4. **Web** : nouveau déploiement SUCCESS, SHA exact, landing HTTPS chargée. Les pages/login doivent appeler uniquement l’API staging ; aucun crash console, secret exposé ou requête production. Vérifier les métadonnées du déploiement et, si présent, /release-metadata.json ; un fichier absent ne doit pas être remplacé par une preuve inventée.
5. **Données conservées** : comparer l’inventaire et les documents/indexes au backup staging ; les changements de topologie ne suffisent pas à prouver cette conservation.
6. **Validation métier** : inscription/login de comptes de test autorisés, rôles/IDOR, messagerie privée et reprise idempotente, XSS/pagination, WhatsApp vérifié avec consentement sans envoi réel, commande directe/stock, livraison et médiation sans ledger/escrow/crédit fictif. Ne pas utiliser les comptes réels ni effacer des collections pour préparer ces tests.
7. **Sécurité/performance** : expiration et suspension, flags fournisseur OFF, absence de secrets dans logs, PWA offline/reconnexion ; Lighthouse mobile sur accueil, produits, panier, commandes, messagerie, vendeur et administrateur. Seuils : performance>=90, LCP<=2,5 s, TBT<200 ms, CLS<0,1, accessibilité/bonnes pratiques/SEO>=95. Une page privée redirigée vers login n’est pas une mesure de son dashboard.

En cas d’erreur : arrêter les étapes dépendantes, relever service/deployment ID, SHA et erreur sans secret. Aucun effacement Mongo, nouvelle variable mot de passe ou déploiement de tête de branche improvisé. Une correction éventuelle sera validée avant sa propre application.

## 10. Reprise automatique

Une surveillance de cette conversation est active toutes les dix minutes. Elle relit uniquement le staging, reste silencieuse tant que rien ne change et ne réessaie pas accept_deploy. Après votre application, elle doit vérifier les nouveaux déploiements et reprendre les tests réels lorsque le candidat fonctionne ; elle signale une panne ou une intervention nécessaire. Cette surveillance dépend de la disponibilité de l’application locale et des connecteurs. Elle ne prouve pas à l’avance la réussite du déploiement et n’autorise aucune action production.

L’étape de production reste distincte : aucun changement de production pendant cette procédure.
