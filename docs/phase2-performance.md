# Phase 2 — performance avant/après

Auteur : Jonathan Kakesa (JonathanK-N). Rapports bruts conservés ; aucune mesure défavorable supprimée.

## Méthode

Lighthouse 13.5.0, profil mobile par défaut, Chrome headless, ralentissement CPU/réseau simulé par Lighthouse. La CI reconstruit la référence immuable `dd6d186`, télécharge l’artefact Web candidate et mesure trois paires séquentielles sur un même runner. Les deux serveurs locaux sont comparables ; leur HTTP local explique le score bonnes pratiques 96/100, qui n’est pas assimilé au HTTPS staging.

La CI mesure ensuite trois fois le staging HTTPS. `staging-context.json` compare le nom du main JS servi au main JS de l’artefact candidate. La concordance évite d’attribuer la mesure à une version non identifiée ; elle ne prouve pas à elle seule que toute la configuration serveur est identique. Ces mesures incluent le réseau et les services Railway réels.

Les essais Windows antérieurs restent disponibles. Le benchmark CPU et des tâches navigateur parallèles ont varié ; ces essais ne servent pas à calculer un gain prétendument reproductible avec la CI.

## Cycles exécutés

| Cycle | Conditions | Performance | Accessibilité / Best / SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|
| Phase 1, rapport initial | Windows initial | 43 | 94 / 100 / 92 | 8,0 s | 1 850 ms | 0,003 |
| Avant phase 2 | Windows, nouveau test | 38 | 94 / 100 / 92 | Rapport brut baseline | Rapport brut baseline | Rapport brut baseline |
| Routes lazy | Windows loop1 | 39 | 94 / 100 / 92 | 6,9 s | 3 840 ms | Rapport brut |
| Image responsive et formateur | Windows loop2 | 43 | 100 / 100 / 100 | 5,4 s | 2 580 ms | 0,005 |
| Animations natives | Windows loop3 | 43 | 100 / 100 / 100 | 5,3 s | 3 870 ms | 0,003 |
| Référence dd6, première comparaison CI | Même runner, médiane 3 paires | 73 | 94 / 96 / 92 | 7,09 s | 141 ms | <0,005 |
| Candidate animations natives 40f8f85 | Même comparaison CI | 86 | 100 / 96 / 100 | 4,09 s | 42 ms | 0,0039 |
| Référence dd6, cycle fonts/preload | Même runner aa587e5 | 71 | 94 / 96 / 92 | 7,24 s | 198 ms | 0,0040 |
| Candidate aa587e5, fonts locales/preload | Même comparaison CI | 97 | 100 / 96 / 100 | 2,66 s | 35 ms | 0,0037 |
| Candidate 03a321d, q45 CDN | Même runner, médiane | 94 | 100 / 96 / 100 | 3,05 s | 42 ms | 0,0037 |
| Référence dd6, cycle local WebP | Même runner 25dd5b9 | 68 | 94 / 96 / 92 | 7,17 s | 42 ms | <0,005 |
| Candidate 25dd5b9, WebP embarqué | Même comparaison CI | 97 | 100 / 96 / 100 | 2,61 s | 2 ms | 0,0037 |
| Candidate 25dd5b9, HTTPS staging identifié | 3 mesures : 89/91/89 | 89 | 100 / 100 / 100 | 3,32 s | 5 ms | 0,000062 |

La compression q45 sur CDN n’a pas donné une amélioration stable : les rapports montrent la variabilité externe. Les ressources critiques ont ensuite été embarquées ; une variante AVIF avec fallback WebP est ajoutée pour réduire encore le poids sans changer la photographie. Le 800 px AVIF pèse 47 029 octets, contre 77 526 pour le WebP embarqué. Les mesures finales de cette candidate sont à consigner après CI.

## Objectifs et lecture

Seuils demandés : performance ≥90, accessibilité ≥95, bonnes pratiques 100, SEO ≥95, LCP ≤2,5 s, TBT <200 ms, CLS <0,1. Le score performance seul ne suffit pas : la candidate WebP a obtenu 97 localement, mais son LCP médian dépassait encore 2,5 s et le HTTPS staging a obtenu 89 médian.

Les gains d’accessibilité, SEO, stabilité et blocage sont confirmés sur plusieurs essais. Le chargement principal reste sensible à la taille des ressources, au chargement React initial, aux RTT et au service statique Railway. Une refonte de rendu serveur ou de chaîne de build ne serait pas une simple correction cosmétique ; elle demande un périmètre et une validation dédiés. Si le seuil final de LCP reste manqué, le résultat est FAIL et non une valeur inventée ou un score sélectionné parmi les meilleurs essais.

Preuves : `release-evidence/phase2/performance-ci-*`, résumés JSON, contextes et rapports Lighthouse complets ; [CI 40f8f85](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38095664925), [CI aa587e5](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38144172084), [CI 25dd5b9](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38145225638).

## Candidate AVIF identifiée, cycle 2c8f721

Concordance main JS staging/artefact : PASS (`main.825d07fe.js`). Référence dd6 : médiane 68/100, LCP 7,124 s, TBT28ms. Candidate locale : 98/98/98, LCP2,318/2,481/2,484s, TBT2/2/4ms. HTTPS staging : 90/99/90, LCP3,169/2,074/3,168s, TBT7/0,5/8ms ; médiane90, LCP3,168s, TBT7ms. Accessibilité100, bonnes pratiquesHTTPS100, SEO100, CLS<0,005 sur toutes ces mesures. Le meilleur score99 n’est pas la synthèse finale. LCP HTTPS : FAIL sur ce cycle.

Le cycle AVIF précédent avait un main JS staging différent du build mesuré : ses résultats HTTPS sont conservés mais ne sont pas attribués à ce SHA. Les rapports locaux de ce cycle restent une comparaison valide de ses builds.

## Résultat final de la version taguée 9176e82

[CI exacte](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38146644352), main JS identique au staging : PASS. Médianes sur3 essais :

| Environnement | Performance | Accessibilité | Best | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Référence dd6 local |68|94|96|92|7,155s|55ms|0,00433|
| Candidate locale |98|100|96|100|2,488s|20ms|0,000028|
| Candidate HTTPS staging |90|100|100|100|3,163s|20ms|0,000062|

Performance/Accessibilité/BestHTTPS/SEO/TBT/CLS : PASS aux seuils demandés sur les médianes HTTPS. LCP HTTPS : FAIL. Domaine global performance : FAIL. Ne pas présenter le score local98 comme le score de Railway. Le gain comparable local est68→98 et LCP7,155→2,488s ; les mesures Windows initiales ne sont pas utilisées dans ce calcul.
