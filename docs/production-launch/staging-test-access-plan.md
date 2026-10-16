# Accès nécessaires aux derniers contrôles staging

Auteur : Jonathan Kakesa (JonathanK-N). 12 octobre 2026.

Le propriétaire a autorisé les tests du SHA déployé 779ec1244bb25077e639ffc4dbe64f17ce344024. Les parcours réels HTTPS et les contrôles de droits passent ; les défauts d’accessibilité mesurés sont corrigés sur codex/afrimarket-staging-validation, sans déploiement. Le candidat correctif est préparé en version 1.1.0-direct-rc.2, Android code 6 et cache v11 ; le tag rc.1 n’est pas déplacé. Le seuil SEO >=95 est conservé pour les pages publiques ; le propriétaire demande que les pages privées restent non indexables.

## A. Accès SSH temporaire

Une clé Ed25519 est générée uniquement dans Afrimarket-private-backups/staging-qa-ssh, répertoire local à ACL propriétaire. La clé privée n’est ni affichée ni versionnée. Empreinte publique : SHA256:UJotkH6X1KEr2bduqWXVlIHxwGLBfZUsh9zQXU0EXC4. Elle n’est PAS enregistrée dans Railway à ce stade.

Proposition nécessitant accord : enregistrer uniquement cette clé publique dans le compte Railway actuel, sous afrimarket-staging-qa-temporary. Les clés personnelles Railway s’appuient sur les droits du compte : l’accès technique peut couvrir d’autres projets accessibles à ce compte. La limitation au staging est une contrainte d’exécution explicite, pas une isolation cryptographique à ce seul service. Aucun accès à un service production n’est autorisé.

Commandes distantes exclusivement sur projet bc40e22f-b963-46fa-a64e-240f3aa954cd, environnement 0fea37a0-e334-4963-952e-d99ca7523ffd et Mongo 80a726a8-1cd5-4387-9e5d-8cd6c9671d9e : version/PRIMARY, rôle readWrite limité à afrimarket_staging_synthetic, refus anonyme et inter-base, index, transactions et comptages/fingerprints sans publication de documents. Toute écriture de test vise seulement un namespace/ID QA unique. Aucun drop, seed, modification de secret, redémarrage ou déploiement par SSH. Préparer une sauvegarde chiffrée/restauration isolée des données staging sans écraser la source ; toute pause d’écritures ou tout redémarrage requis sera présenté séparément avant exécution. Retirer ensuite la clé publique du compte et la clé privée locale, après confirmation de retrait côté Railway. Si une validation 2FA est requise, la faire dans le tableau de bord, sans code dans le chat.

## B. Mesures HTTPS sur runner CI

Proposition nécessitant accord : créer dans le seul dépôt JonathanK-N/sellers-hub-2 trois secrets GitHub Actions : STAGING_QA_TOKEN_BUYER, STAGING_QA_TOKEN_SELLER, STAGING_QA_TOKEN_ADMIN. Ce sont des sessions staging valides 45 minutes, pour les deux comptes TEST existants et l’administrateur staging utilisé lors du parcours HTTPS. Aucun mot de passe, clé JWT de signature, secret Mongo ou secret production ne sera transféré. Les sessions seront renouvelées uniquement pour un run autorisé, puis les secrets supprimés après les mesures. Les personnes/workflows autorisés du dépôt peuvent utiliser ces sessions pendant leur validité ; le token admin accède à l’administration staging.

Le workflow prêt .github/workflows/staging-https-audit.yml vérifie le healthcheck/SHA réel avant mesure, authentifie chaque rôle, conserve les sessions et rapports bruts uniquement dans RUNNER_TEMP à accès restreint et publie seulement un résumé sans credentials ni capture de contenu privé. Les sept pages sont réellement chargées sur HTTPS Railway ; aucune redirection login n’est assimilée à une mesure de dashboard. Lighthouse 13.5.0 conserve le profil mobile et les seuils demandés ; Playwright 1.60.0 est épinglé. Le run est déclenché manuellement ou par le label staging-https-audit sur la PR de validation du même dépôt.

L’indice CPU observé localement (~300–360) diffère fortement de celui du runner CI (~3100–3350). Cela justifie une mesure sur runner contrôlé ; cela ne transforme pas les échecs locaux en PASS et n’autorise pas à réduire les seuils ou le ralentissement CPU. Les premières mesures locales restent archivées.

La configuration des secrets et l’enregistrement SSH ne déploient aucun service. Le correctif rc.2 devra ensuite passer ses tests et faire l’objet d’une application staging distincte et approuvée. Aucune opération de production n’est incluse.
