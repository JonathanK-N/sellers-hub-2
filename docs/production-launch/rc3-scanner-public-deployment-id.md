# Signalement du déploiement public dans la preuve rc.2

Auteur : Jonathan Kakesa (JonathanK-N).

Le scanner historique signale la ligne 9 de docs/production-launch/staging-rc2-validation.md au commit local 0ff319a85b4780eec26c0ebe3afe9915b93500ca. Cette ligne décrit les identifiants publics de déploiement Railway et du volume ; elle ne contient aucun mot de passe, token, secret OTP ni clé privée. Le mot « API » suivi d’un identifiant de déploiement déclenche generic-api-key.

Empreinte exacte proposée : `0ff319a85b4780eec26c0ebe3afe9915b93500ca:docs/production-launch/staging-rc2-validation.md:generic-api-key:9`.

Le correctif applicatif rc.3 est préparé localement dans ce commit mais n’a pas été poussé après le résultat FAIL du scanner. Aucun déploiement déclenché. L’historique n’est pas réécrit ; aucune exclusion supplémentaire n’est activée. Les règles, seuils et autres occurrences restent inchangés. L’accord du propriétaire doit viser cette seule empreinte avant de reprendre le push et la CI exacte.

Cette demande n’autorise ni déploiement staging, ni fusion, ni opération de production. Les sept pages du staging rc.2 restent non validées dans leur ensemble : cinq dépassent encore le LCP demandé. Les preuves sont dans docs/production-launch/staging-rc2-validation.md.
