# Reprise contrôlée de la PR #15

Auteur : Jonathan Kakesa. 17 octobre 2026, Toronto.

Base publiée vérifiée : 4464a789abf5f8ac64ee6cbef649820d1616f5c7, feature/afrimarket-transactional-emails. Aucun développement antérieur réinitialisé.

## Résultats locaux

- 51 tests e-mail PASS, dont les 26 rendus HTML/texte. Le nouveau test appelle la vraie assignation après décisions d’affiliation synthétiques : réseau/boutique exacte autorisés, manquante/autre boutique/inactive refusés. Une première collecte sans PYTHONPATH a échoué ; email-tests-environment-failure.log est conservé. Aucun test ignoré dans la reprise réussie.
- Répétition Mongo complète PASS : standalone authentifié vers replica set sur même dbPath, empreintes/index conservés, transaction commit/abort, sauvegarde chiffrée avant disque et restauration exacte dans un nouveau répertoire, retour standalone conservant un commit post-conversion. Aucun accès production par ce script. Trois premiers échecs du harnais sont conservés : format keyfile base64url incorrect, découverte d’un replica set non initialisé sans directConnection, puis client conservant la topologie bootstrap avant élection. Les corrections visent le harnais, pas les données production.
- Variables : cinq valeurs toujours mal saisies. Diff exact dans production-config-diff.json, appliqué=false. Voir configuration-plan.md pour l’ordre sûr et les approbations.
- Nouvel audit Mongo production en lecture seule : standalone, trois profils actifs sans affiliation, aucun doublon ou boutique orpheline. Aucun identifiant personnel publié.
- Resend : sending enabled avec DKIM/SPF verified ; receiving enabled mais MX pending. Pas de preuve de réception. Logo actuel HTML, fichier officiel prêt dans frontend/public/assets/email. Révocation ancienne clé NON prouvée : clé ancienne non identifiée ; une seule clé actuelle visible ne suffit pas.

## Diagnostic performance et correction ciblée

Le graphe initial contenait 16 requêtes JavaScript, notamment de nombreux très petits modules d’icônes partagés. Regrouper les modules lucide-react dans un chunk partagé conserve les icônes, fonctions et CSS, et réduit les requêtes observées à cinq. Le build réussit ; le test de graphe de routes passe. Le budget et le profil Lighthouse sont inchangés.

La préparation du staging a aussi identifié des écritures au démarrage par le scheduler, indépendantes du seed. BACKGROUND_JOBS_ENABLED=false empêche son lancement, y compris refresh FX immédiat et expiration des invitations. Trois tests vérifient que false et des valeurs mal formées ne démarrent aucun job. Le comportement par défaut true des autres environnements est conservé. Aucun paramètre Railway modifié.

Les trois mesures locales avec aperçu valide restent FAIL :

| Série | LCP ms | TBT ms | Performance | A11y / bonnes pratiques / SEO |
|---|---:|---:|---:|---|
| 1 | 2476,378 | 898,187 | 75 | 100 / 100 / 100 |
| 2 | 2621,161 | 665,113 | 78 | 100 / 100 / 100 |
| 3 | 2410,557 | 824,241 | 76 | 100 / 100 / 100 |

Les benchmarkIndex locaux 335 / 370 / 320.5 reflètent les mesures enregistrées, sans compensation des seuils. Les coûts script/style/layout restent élevés sur cet hôte. Le regroupement réduit le nombre de requêtes, mais ne prouve pas à lui seul la conformité des budgets. Attendre les résultats CI du SHA publié et garder le FAIL local visible.

La première série locale utilisait par erreur le build pointant directement vers l’API distante ; son origine localhost a reçu des erreurs CORS. Ses résultats FAIL sont conservés dans lighthouse-icons.json/log et ne servent pas de comparaison valide au profil CI. Le build d’aperçu a été refait avec API relative, comme en CI, et le proxy existant ne fait que des lectures staging. Aucun CORS Railway modifié. L’image hero et le rendu restent inchangés.

## Limites et décision

NO-GO production. Aucun déploiement, envoi réel, DNS, migration ou modification de variables/données production. La prochaine validation HTTPS et les tests Resend nécessitent des approbations séparées. La nouvelle CI doit être relue intégralement avant de proposer le SHA comme candidat staging. La PR reste en brouillon et non fusionnée.

Procédures : configuration-plan.md, mongo-affiliation-plan.md et ../final-readiness/staging-approval-plan.md.

## Complément — regroupement sélectif

Le cycle CI de 0da48ac échoue encore sur sa première série (2551,037 ms) ; les deux suivantes passent (2423,8505 / 2417,9917 ms). Ces résultats ne sont pas remplacés par une moyenne. Le regroupement est limité ensuite aux icônes réellement utilisées par l’accueil et la bannière d’installation : les icônes privées restent différées. L’instrumentation Lighthouse publie aussi le nombre, les chemins et les tailles des scripts locaux ; aucun seuil ni throttling modifié. Le dernier candidat reste à valider intégralement.

## Revalidation aa71468 et priorité réseau

Le deuxième cycle CI, SHA aa71468fc13cf5c086a3b0abdde3f7907876ed52, passe ses trois séries : LCP 2253,83505 / 2262,4764 / 2412,4901 ms ; TBT 64 / 10,5 / 22,5 ms ; performance 97 aux trois passages. La première CI en échec et les mesures locales restent conservées.

Le candidat suivant réduit encore le chunk partagé de 10,10 à 5,65 Ko gzip en excluant les icônes des écrans privés. La découverte de l’image hero est placée avant le graphe de modules : auparavant les indices JavaScript étaient injectés avant son preload. Un contrôle du build vérifie cet ordre tout en conservant le graphe propre à chaque route. Aucun nouveau contenu, changement de rendu ou de seuil. Build et contrôles de graphe/notifications PASS ; la CI du nouveau SHA doit être relue avant conclusion.

## Vérification du candidat 5f410ed — ajustement non retenu

La CI 39012629426 donne LCP 2566,567 / 2408,4224 / 2406,8253 ms et TBT 132 / 12,5 / 6,5 ms. La première série échoue : le candidat reste NO-GO malgré cinq requêtes JS. On ne peut pas attribuer avec certitude la différence à un seul changement plutôt qu’à la variabilité des exécutions. Le regroupement sélectif et le déplacement du preload ne sont pas retenus ; les quatre fichiers frontend/instrumentation sont restaurés depuis aa71468, dont les 12 jobs ont réussi. Ce retour ne supprime aucune preuve de l’essai. Le nouveau SHA devra repasser toute la CI.
