# Sécurité phase 3

Auteur : Jonathan Kakesa (JonathanK-N).

Les audits des dépendances Web, y compris développement et build, passent après migration de Create React App/CRACO vers Vite 8.3.4 et Tailwind 4.3.3. Les dépendances vulnérables de la chaîne historique sont remplacées et le lockfile est figé. Les contraintes de version concernent aussi les dépendances transitives ; aucune vulnérabilité n'est masquée par un seuil abaissé.

Backend : pip-audit sur requirements, Ruff F821 et Bandit passent. Bandit analyse le code applicatif sans exclusions nosec ; les tests sont séparés de la cible SAST. Les exceptions silencieuses ont été remplacées par des journaux explicites, les projections Mongo ambiguës reformulées et les jetons aléatoires générés avec secrets. La suppression des annotations nosec avait révélé un faux positif supplémentaire sur le schéma bearer ; la version finale utilise le schéma standard de FastAPI.

Gitleaks 8.30.1 analyse tout l'historique accessible à HEAD, avec sortie expurgée, sans liste d'autorisation personnalisée. Les binaires sont vérifiés par SHA-256. Les audits constatent l'absence de vulnérabilités connues au moment du contrôle ; ils ne constituent pas une garantie permanente.

Les tests ciblés couvrent les permissions, la confidentialité des commandes, les JWT invalides, les montants non finis, les uploads, les signatures HMAC et les erreurs de santé sans divulgation d'URI. Le healthcheck affiche la version rc.3 et, lorsque Railway le fournit, le SHA de déploiement.

Le bootstrap Mongo staging refuse des références de credentials non résolues, utilise une clé persistante privée et un compte applicatif readWrite limité à afrimarket_staging_synthetic. Les valeurs d'authentification ne sont pas enregistrées dans le dépôt, les rapports ou les artefacts publiables. Le connecteur OAuth ne permet pas de créer des variables scellées : leur configuration dans Railway reste BLOCKED. Aucun accès Mongo public n'est demandé.

Preuves finales : release-evidence/phase3/ci-manifest.json, backend-sast.json, backend-audit.json, web-audit.json et secrets-redacted.json. Consulter les statuts et SHA du manifeste pour distinguer les premières boucles en échec du candidat validé.
