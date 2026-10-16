# Signalement historique du SHA de staging

Auteur : Jonathan Kakesa (JonathanK-N).

Gitleaks signale generic-api-key sur docs/production-launch/staging-observation.json:9 au commit aa9dde7918b955f76191e10c75f672cc1bf452d4. La valeur est uniquement le SHA de commit Git 779ec1244bb25077e639ffc4dbe64f17ce344024, déjà visible dans les métadonnées du déploiement et dans /api/health. Le nom de champ apiHealthSourceSha déclenche la règle ; il ne s’agit ni d’un token ni d’un secret d’authentification.

La source courante renomme ce champ healthReportedCommit, sans changer la valeur ni la portée du scanner. L’historique est conservé. Empreinte précise proposée : aa9dde7918b955f76191e10c75f672cc1bf452d4:docs/production-launch/staging-observation.json:generic-api-key:9.

Aucune exclusion n’est activée sans accord du propriétaire. Les règles, seuils, autres occurrences et recherche sur tout l’historique restent inchangés. Le contrôle reste FAIL jusqu’à résolution approuvée. La branche de validation a été poussée avant traitement de ce résultat ; aucun secret n’a été publié, mais le push aurait dû attendre l’examen du scanner.
