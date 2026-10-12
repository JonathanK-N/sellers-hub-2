# Déblocage des secrets Mongo staging

Auteur : Jonathan Kakesa (JonathanK-N).

La CLI et le schéma public actuel VariableUpsertInput n’exposent aucune option de scellement. La [documentation Railway](https://docs.railway.com/variables#sealed-variables) décrit ce scellement dans le tableau de bord. Le propriétaire ne peut pas le faire actuellement.

Le propriétaire a explicitement autorisé les variables standard pour le staging. Deux mots de passe aléatoires distincts de 48 caractères ont été enregistrés avec skipDeploys=true dans MONGO_INITDB_ROOT_PASSWORD et MONGO_APP_PASSWORD, puis leur présence et leur longueur ont été vérifiées sans afficher les valeurs. Aucun déploiement n’a été déclenché.

Alternative proposée pour ce staging exclusivement synthétique : générer deux mots de passe aléatoires distincts de 48 caractères et les enregistrer dans les variables Railway standard du service afrimarket-mongo-staging, avec skipDeploys=true. Railway conserve ces variables de manière protégée, mais leurs valeurs peuvent être lues par les comptes autorisés du workspace, contrairement aux variables scellées. Aucune valeur ne doit apparaître dans le chat, Git, les arguments CLI ou les rapports. Garder l’authentification Mongo, le compte applicatif readWrite limité à sa base, le réseau privé et la clé replica set privée sur volume.

Cette alternative requiert l’accord du propriétaire car elle remplace le choix de scellement proposé précédemment. Elle ne concerne aucun secret de production et n’autorise pas à contourner le refus d’application du déploiement Railway. Une fois les variables prêtes, revalider le patch entier et utiliser le mécanisme d’application Railway autorisé.
