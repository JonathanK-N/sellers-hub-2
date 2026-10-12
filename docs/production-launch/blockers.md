# Blocages

Auteur : Jonathan Kakesa (JonathanK-N).

- BLOCKED : accès au schéma, index, comptages et backup Mongo production. OAuth fournit les noms des variables, pas les URI authentifiées. Ne demander aucune valeur secrète dans le chat.
- BLOCKED : MONGO_INITDB_ROOT_PASSWORD et MONGO_APP_PASSWORD staging ne sont pas visibles comme scellées ; aucune conversion appliquée.
- BLOCKED : application Railway précédemment refusée par contrôle d’approbation. Ne pas contourner par connect live, CLI ou API alternative.
- BLOCKED : déploiement production jusqu’au backup/restauration vérifiés, staging réel, compatibilité et approbation finale concrète.
- CinetPay non certifié reste désactivé et ne bloque pas le parcours direct autorisé.
