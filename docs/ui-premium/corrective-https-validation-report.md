# Dynamic Premium — validation HTTPS après correction de session

Auteur : Jonathan Kakesa (JonathanK-N). Date client : 15 octobre 2026.

## Décision : NO-GO

Le déploiement Web est SUCCESS, mais les performances HTTPS ne satisfont pas les critères. Aucun GO production. Aucun changement Railway effectué pendant ces contrôles.

## Provenance réelle

Web : 584f0c463ee53e65be790526cb38819eb8d6dd83, déploiement ce6b813b-f779-41f9-b8e9-e4564b8bd127. Son code applicatif est identique au candidat approuvé 838cc9523267be74561edd9b395d46615b2fad0a ; les différences sont documentaires. Le bundle HTTPS /assets/index-DAc0oo52.js a le SHA256 f45aaa1d7ca8981ae27fa2d6e50ba500262e1c1ab833f4fe5d867eb7e38368e5, identique à l’artefact CI approuvé. La configuration Railway reste épinglée à 838cc952, ce qui ne remplace pas la preuve du commit effectivement exécuté.

Backend : 2806d719bf0edbdc31ebd32ab0887e1fb4dc40cb ; déploiement 1a774143-96db-4cb8-a0be-19116988a51f SUCCESS. Mongo : déploiement a72b1bb3-5a19-4049-b1fe-e1067ae6cd3f SUCCESS, volume b0f66ec2-2328-4b12-aecb-47847c6d5733, /data/db, 1024 MB inchangés. Aucune modification des secrets, des données ou de la production. Aucun patch en attente au dernier inventaire.

## Sept pages HTTPS à froid — deux séries conservées

Lighthouse 13.5, profil mobile par défaut, nouveau navigateur isolé par page. Sessions initialisées sur robots.txt sans précharger les ressources applicatives. Aucune écriture serveur. Seuils inchangés : performance ≥90, LCP ≤2500 ms, TBT <200 ms, CLS <0,1, accessibilité et bonnes pratiques ≥95 ; SEO public ≥95, pages privées non indexables.

| Page | Perf série 1 | LCP 1 ms | Perf série 2 | LCP 2 ms | TBT 2 ms | Série 2 |
|---|---:|---:|---:|---:|---:|---|
| accueil | 99 | 1734.7 | 78 | 2942.9 | 602.0 | FAIL |
| produits | 91 | 3342.7 | 88 | 3344.6 | 228.0 | FAIL |
| panier | 95 | 2805.0 | 97 | 2533.3 | 0.0 | FAIL |
| commandes | 97 | 2378.3 | 98 | 2175.4 | 3.5 | PASS |
| messagerie | 93 | 3146.4 | 94 | 2997.0 | 0.0 | FAIL |
| vendeur | 92 | 3153.7 | 94 | 2987.8 | 0.0 | FAIL |
| administrateur | 97 | 2349.5 | 98 | 2170.5 | 0.0 | PASS |

Sources : [série 1](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38840744159), [série 2 diagnostic](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38841227001). Résumés anonymisés et empreintes d’artefacts : corrective-https-lighthouse-ci-loop1.json, corrective-https-lighthouse-ci-loop2.json, corrective-https-ci-provenance.json. Les rapports bruts authentifiés restent hors Git. L’accueil passe en série 1 mais échoue en série 2 ; cette variation n’est pas écartée. Quatre pages privées échouent dans les deux séries.

## Diagnostic et correctif proposé

La vérification native de session fonctionne avant le chargement du client Axios privé, confirmé en bloquant ce chunk. Elle ne suffit pas à atteindre les seuils. Le composant React.lazy recrée une suspension au montage malgré un import anticipé déjà terminé. Un essai contrôlé retient /auth/me jusqu’après téléchargement du module Home : le premier GET produits reste retardé de 401 ms après libération de la session, sans requête privée avant authentification. React 19.0.0 contient un délai de présentation de fallback de 300 ms. Cela confirme une cause de latence ; cela ne prouve pas que toute la durée LCP vient de ce seul délai.

Le candidat suivant partage la promesse d’import et le composant chargé, garde une identité stable au montage, et ajoute dans le HTML des modulepreload limités au graphe JavaScript de la route initiale, ainsi qu’un preconnect vers l’origine publique du backend. Aucune donnée privée préchargée et gardes de rôles inchangées. Les tests vérifient le chemin lent, le chemin prêt, le rejet d’import, les cycles et chemins Windows, et les fichiers réellement compilés. Références : [Vite transformIndexHtml](https://vite.dev/guide/api-plugin.html#transformindexhtml), [préchargements Vite](https://vite.dev/guide/features.html#preload-directives-generation). Les nouvelles mesures HTTPS sont obligatoires après approbation et application.

## Contrôles fonctionnels et limites

PASS : session native pendant blocage Axios ; absence de requêtes privées avant validation ; affichage public sans débordement à 320, 390, 768 et 1440 px ; cache v14 remplaçant un HTML v13 périmé dans un navigateur de test ; aucune réponse API en cache ; réponse hors ligne API 503. Preuves : corrective-https-session.json et corrective-https-public-pwa.json.

Les preuves de lecture seule précédentes couvrent rôles et refus 401/403, commandes existantes, messagerie existante, caractéristiques du paiement direct, consentement WhatsApp sans envoi, panier local et absence de champs password_hash/OTP dans les réponses contrôlées. Voir https-validation-report.md et ses JSON associés. Les créations de commandes, paiements, messages et changements de données restent NON VALIDÉS en HTTPS, car interdits dans cette mission. La recherche par nom de boutique étendue nécessite un backend non déployé ; elle reste non certifiée.

Ne pas redéployer le backend sandbox : son démarrage effectue un seed malgré SEED_DEMO=false. Aucune migration, seed ou préparation de production à ce stade.

## Historique CI du nouveau correctif

a88f4b11881f464dc0e27d1c50ea82f7926542c3 : douze jobs réussis, run 38842776401.
5aed053b458e358b616a32996d2f5fd6097d28d7 : dix jobs réussis, deux échecs, run 38843091924. Le nouveau test de navigation utilisait une réponse simulée {} au lieu de [] pour les bannières ; fixture corrigée sans affaiblir l’assertion. Le conteneur Mongo synthétique local de CI était arrêté avant les tests métier ; cause de cet arrêt non confirmée dans les logs disponibles. Ces échecs restent conservés. Nouvelle CI en cours sur 6606024e027ed163e697100ed83b8ff3475785ac. Aucun déploiement de ce candidat autorisé ou effectué.

## Candidat figé pour une nouvelle approbation

6606024e027ed163e697100ed83b8ff3475785ac, branche codex/afrimarket-dynamic-postdeploy-validation, PR11 indépendante non fusionnée. Les 28 contrôles UI passent sur Chromium, Firefox et WebKit ; les trois audits publics froids de prévisualisation donnent LCP 2103,4 / 2260,5 / 2261,2 ms, performance 98 / 97 / 97, TBT 7 / 9,5 / 10 ms, accessibilité / bonnes pratiques / SEO 100. Ce sont des contrôles CI, pas un certificat HTTPS. Les 163 fichiers de l’artefact Web et les empreintes ZIP Web/UI sont vérifiés ; sourceSha exact confirmé. Plan minimal : postdeploy-corrective-approval-plan.md. Les documents sont publiés sur une branche distincte pour garder la branche candidate figée.

CI finale : [run 38843829543](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38843829543), douze jobs SUCCESS au SHA exact 6606024e027ed163e697100ed83b8ff3475785ac. Les deux échecs de la précédente exécution sont conservés ci-dessus. Les trois secrets GitHub temporaires sont absents (GET 404) et les trois fichiers locaux de sessions de ce cycle sont supprimés.

Dernier healthcheck API : HTTP 200, status ok, mongodb ok, response_ms 8, version rc.4/source 2806d719 ; fx_rate no_data reste une limite signalée, sans ajout de données.
