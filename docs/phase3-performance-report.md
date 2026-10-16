# Performance phase 3

Auteur : Jonathan Kakesa (JonathanK-N). Source : 058b6a51bf00c4525155b20e1e1a96e939fdfad5. CI : 38166788235.

Trois mesures mobiles Lighthouse 13.5.0 par build sur le même runner, baseline immutable rc.2 (9176e82) puis candidat compilé, avec le même backend staging configuré. Les résultats sont des mesures de laboratoire, pas des Core Web Vitals utilisateurs.

| Build / essai | Performance | LCP ms | TBT ms | CLS | Accessibilité | Bonnes pratiques | SEO |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline 1 | 85 | 2448.03 | 496.50 | 0.00367 | 100 | 96 | 100 |
| baseline 2 | 98 | 2493.84 | 10.00 | 0.00002 | 100 | 96 | 100 |
| baseline 3 | 98 | 2486.77 | 16.00 | 0.00367 | 100 | 96 | 100 |
| candidate 1 | 98 | 2268.19 | 0.00 | 0.00365 | 100 | 96 | 100 |
| candidate 2 | 97 | 2420.97 | 0.00 | 0.00367 | 100 | 96 | 100 |
| candidate 3 | 97 | 2418.85 | 0.00 | 0.00367 | 100 | 96 | 100 |
| staging 1 | 99 | 2026.98 | 4.50 | 0.00404 | 100 | 100 | 100 |
| staging 2 | 99 | 2022.69 | 3.00 | 0.00369 | 100 | 100 | 100 |
| staging 3 | 99 | 2026.71 | 5.50 | 0.00404 | 100 | 100 | 100 |

Candidat local : médiane 97, LCP 2418,85 ms, TBT 0 ms, CLS 0,00367, accessibilité/SEO 100, bonnes pratiques 96. Toutes les cibles demandées passent dans cette série locale. L’ancienne boucle CSS4 avant intégration des styles mesurait 3192,53 ms de LCP médian : FAIL ; les styles compilés et les déclarations de fontes sont maintenant intégrés au document sans changer leur contenu, avec assets conservés pour les imports différés et le cache.

La baseline rc.2 de la série finale mesure 98 et 2486,77 ms. Dans une série antérieure avec le même runner par paire, elle mesurait 93 et 3203,57 ms. Cette variabilité interdit de promettre une accélération stable en production à partir d’un seul comparatif. La cible locale est satisfaite et le TBT baisse ; le score rc.3 est inférieur d’un point au rc.2 final.

Le staging HTTPS observé est encore le bundle /static/js/main.825d07fe.js ; le candidat attend /assets/index-CRu5KGA-.js. artifactMatchesStaging=false. Ses mesures ne certifient donc pas rc.3, même lorsque leurs cibles passent. Statut de certification rc.3 déployée : BLOCKED. Aucune mesure n’a été éliminée pour améliorer la médiane.

Preuve synthétique : ../release-evidence/phase3/performance-final.json ; rapports bruts et version navigateur dans l’archive de preuves CI.
