# Dynamic Premium 6606024 — décision HTTPS

Auteur : Jonathan Kakesa (JonathanK-N). Contrôle du 16 octobre 2026 UTC.

## NO-GO production

La demande de mise en production est enregistrée, mais le prérequis de validation staging n’est pas satisfait. Aucun changement de production, de MongoDB, de volume, de secrets Railway ou de données ; aucune fusion.

## Provenance vérifiée après intervention du propriétaire

Web 6606024e027ed163e697100ed83b8ff3475785ac, Railway 62b1a5f8-a450-4611-823b-f2cb98b663a1 SUCCESS, branche codex/afrimarket-dynamic-postdeploy-validation. Bundle /assets/index-D1sBFCvN.js, SHA256 2e2dcaaaa36345cb2250d9e2b35cdea78e90da2e1cd4245393112ade4927d4d1, identique à l’artefact compilé vérifié du candidat. Backend conservé au SHA 2806d719bf0edbdc31ebd32ab0887e1fb4dc40cb.

## Sept mesures HTTPS à froid

[Exécution 38847582896](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38847582896), outils d062fa562f81f5e8a2e67a7090f4eb2ebe802749. Lighthouse 13.5, profil mobile par défaut et navigateur neuf par page, aucune ressource applicative préchauffée. Seuils inchangés : performance ≥90, LCP ≤2500 ms, TBT <200 ms, CLS <0,1, accessibilité/bonnes pratiques ≥95. SEO public ≥95 ; privé volontairement non indexable, score 63 attendu.

| Page | Perf | LCP ms | TBT ms | Accessibilité | Bonnes pratiques | SEO | Résultat |
|---|---:|---:|---:|---:|---:|---:|---|
| accueil | 85 | 2720.7 | 426.3 | 100 | 100 | 100 | FAIL |
| produits | 93 | 3025.7 | 94.0 | 100 | 100 | 63 | FAIL |
| panier | 96 | 2627.3 | 13.0 | 100 | 100 | 63 | FAIL |
| commandes | 95 | 2640.5 | 138.5 | 95 | 100 | 63 | FAIL |
| messagerie | 94 | 2956.0 | 10.0 | 100 | 100 | 63 | FAIL |
| vendeur | 94 | 2965.0 | 21.0 | 100 | 100 | 63 | FAIL |
| administrateur | 96 | 2633.5 | 19.5 | 100 | 100 | 63 | FAIL |

Les sept pages échouent au LCP ; l’accueil échoue aussi en performance et TBT. Tous les CLS restent inférieurs à 0,002. Aucun échec masqué ou seuil modifié. Résumé anonymisé : 660-https-lighthouse-loop1.json. Artefact 12023786934, empreinte sha256:53a86831af1c5f01bd0e2a6e463f123f496c8db3f072787e362d3a0304cbc5ab, vérifiée avant extraction.

## Diagnostic confirmé et limite

Le GET /auth/me de la page produits se termine vers 225,6 ms ; les requêtes métier débutent vers 243–272 ms. Le délai de près de 400 ms constaté sur le candidat précédent est donc supprimé dans cette trace. Les modules privés sont demandés dès 61–82 ms, avant la vérification de session, sans requête de données privées avant cette vérification. Le correctif agit bien sur la cause ciblée, mais ne suffit pas au budget Lighthouse.

La chaîne restante comprend le bundle initial de 96 306 octets transférés, l’exécution JavaScript, la vérification de session et le rendu des écrans. L’accueil mesure 652,8 ms d’évaluation de scripts et 435,2 ms de délai réel de rendu de l’image LCP. Les durées réseau observées et le LCP simulé de Lighthouse sont des mesures différentes : aucune attribution de la totalité du dépassement à un seul module n’est démontrée. Une analyse supplémentaire du bundle/CPU et un nouveau correctif vérifiable sont nécessaires avant toute nouvelle proposition Railway. Les anciennes séries restent dans corrective-https-validation-report.md.

## Parcours et sécurité

PASS : accès anonyme commandes 401 ; acheteur vers administration et vendeur 403 ; lectures commandes/conversations/fiche vendeur/administration 200 selon le rôle. Aucun champ password_hash, otp_secret, otp_code ou JWT_SECRET dans les réponses contrôlées. Ce contrôle porte sur ces réponses, pas sur une preuve d’absence universelle.

PASS : ajout local au panier, quantités +/−, total et navigation panier ; aucune commande soumise. Lien WhatsApp présent, aucun envoi ni navigation WhatsApp. Session rejetée 401 effacée puis redirection connexion. Responsive sans débordement 390/768/1440 px, préférence de mouvement réduit respectée.

PASS : migration du worker v13 (interception limitée au navigateur de test) vers les octets v14 réellement servis en HTTPS ; ancien cache supprimé, cache tiers conservé, aucune entrée API en cache ; API hors ligne 503.

Preuves : 660-https-permissions.json, 660-https-cart.json, 660-https-session-responsive.json, 660-https-pwa.json. Tests limités à GET/HEAD/OPTIONS ; zéro écriture serveur. Les opérations de commande, message et paiement nécessitant une écriture restent non certifiées conformément à l’interdiction de modifier les données. Aucune préparation destructive ou déploiement de production.

## Nettoyage

Les trois sessions GitHub Actions temporaires sont supprimées et leur absence vérifiée par GET 404 ; les trois fichiers locaux temporaires de sessions sont retirés. Aucune clé de signature ni mot de passe transféré à GitHub.

## Boucle corrective supplémentaire — aucun déploiement

PR12 indépendante : https://github.com/JonathanK-N/sellers-hub-2/pull/12. Le candidat eb59561399e8cf35f4032b39b16f3b35362d57b6 isole le code de l’accueil et réduit le bundle initial gzip de 95869 à 89181 octets (~7 %). Ses 28 contrôles UI passent, mais les trois LCP de prévisualisation échouent à 2711,4 / 2707,8 / 2707,3 ms. Les échecs sont conservés dans entry-budget-preview-failed.json.

Le candidat suivant f80223e4d0bb946c2f556009442f59c94455e9ba attend le module public avant le premier montage sans retarder les routes privées. Artefact Web vérifié, 174 empreintes, 28 contrôles UI réussis. Ses trois LCP échouent encore à 4660,5 / 2558,2 / 2553,0 ms, TBT 972 / 30 / 30 ms (run 38848926787). Le premier essai présente un CPU benchmark nettement plus faible, mais reste comptabilisé ; aucune mesure n’est écartée. Le candidat reste NOT READY, ne doit pas être déployé et n’est pas soumis à approbation Railway. La réduction des octets n’est pas une preuve de respect du LCP.

La cause complète du dépassement simulé restant n’est pas établie ; une analyse supplémentaire du chemin de chargement et du CPU est nécessaire. Le dernier staging confirmé reste 6606024 SUCCESS, les trois services en ligne et aucun patch en attente. La production reste intacte.
