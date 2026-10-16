# Analyse et migration de la chaîne Web

Auteur : Jonathan Kakesa (JonathanK-N).

La phase 2 conserve CRA 5 / CRACO 7, Jest et webpack-dev-server, dont les chemins d'audit sont vulnérables malgré les corrections runtime. La majorité des alertes restantes provient de cette chaîne : node-forge, braces, sprintf-js, svgo/nth-check, middleware webpack, serialize-javascript et dépendances de Jest. Certaines versions ne disposent pas d'un correctif dans leur branche. Le serveur publié sert des fichiers statiques, mais l'exposition de la CI et du développement doit aussi être traitée.

Analyse d'impact : l'application utilise React 19, des imports ES, React Router, Tailwind 3 et deux fichiers contenant du JSX sous extension .js (App et index). Pas d'import require, de SVG ReactComponent, de reportWebVitals ni de suite Jest active détecté dans src. L'alias @, les variables publiques REACT_APP, les URLs publiques, les lazy imports, le répertoire build de Capacitor et le fallback SPA doivent être préservés. Les plugins CRACO de diagnostic optionnels restent historiques, sans être chargés en production.

Décision : Vite 8 et plugin React 6, versions exactes vérifiées dans le registre ; Le premier essai conserve Tailwind 3, mais son audit révèle ensuite GHSA-vfj7-8cjw-p6xm dans braces sans version corrigée publiée. La chaîne CSS passe donc à Tailwind 4.3.3 et au plugin Vite officiel, en chargeant explicitement la configuration existante. Les classes renommées (ombres, rayons, flou, outline, flex et gradients) sont adaptées pour conserver leur sens ; les variables de la palette verte et le plugin animations sont conservés. Renommer uniquement App/index en .jsx, conserver les autres modules et toutes les améliorations visuelles. Limiter les variables exposées au navigateur à la liste publique déjà utilisée. Le HTML devient une entrée Vite ; public conserve les assets, polices, licences, manifest et worker. Conserver build comme sortie et utiliser le serveur statique existant. Mettre à jour les outils qui identifient le bundle principal.

Validation requise : installation figée, audit complet incluant développement, compilation, comparaison visuelle, routes et recherche, API ciblée staging, modales clavier, PWA ancienne→nouvelle et hors ligne, build APK et émulateur. Une migration compilée n'est pas automatiquement une validation fonctionnelle. Les résultats seront enregistrés dans le rapport de sécurité et le rapport final.

Références : [configuration Vite](https://vite.dev/config/shared-options), [assets statiques](https://vite.dev/guide/assets.html), [déploiement](https://vite.dev/guide/static-deploy.html), [variables publiques](https://vite.dev/guide/env-and-mode).

Compatibilité à vérifier : Tailwind 4 exige Chrome/WebView 111+, Safari 16.4+ et Firefox 128+. Les anciens navigateurs ne sont pas certifiés. La migration demeure en branche dédiée et doit être vérifiée visuellement avant publication. Les changements de sélecteurs space/divide et de préflight font partie de cette vérification.

Références CSS : [migration officielle](https://tailwindcss.com/docs/upgrade-guide), [avis braces sans correctif](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Aucun seuil d’audit n’est abaissé pour contourner cet avis.
