# Notifications, vérification e-mail et espace vendeur

Auteur : Jonathan Kakesa.

Branche : `feature/realtime-notifications-seller-onboarding`, issue de `49f3c92087e2d809250be64a353f743cd83a2c9f`.

## Comportement

- Les notifications persistées déclenchent un flux SSE authentifié. Les événements signalent un changement ; le contenu est relu par les API protégées. Le serveur filtre les événements par propriétaire et vérifie régulièrement la session. Le client reconnecte, resynchronise et ferme la connexion au changement de compte ou à la déconnexion.
- Le badge et la liste des notifications se rafraîchissent sur événement. La messagerie reçoit aussi ces invalidations et conserve une réconciliation périodique pour les états de lecture.
- Les alertes hors application nécessitent une configuration Firebase valide. Un faux jeton de démonstration ne peut plus être présenté comme une activation réussie.
- Une demande de vérification invalide les anciens liens dans la même transaction. L’adresse déjà vérifiée reste utilisable pendant un changement. La confirmation refuse un autre compte connecté et actualise le profil. Les liens restent à usage unique, avec expiration. Le fragment est retiré de l’URL et conservé au maximum dix minutes dans le stockage de l’onglet pour permettre un rechargement ; il est supprimé après succès.
- Un acheteur peut activer un espace vendeur puis revenir à ses achats. Son identifiant, son rôle principal, ses commandes et ses messages sont conservés. La capacité vendeur est accordée par le serveur ; le JWT sélectionne uniquement un espace autorisé. Aucune attribution de droits administrateur ou livreur n’est possible par cette API.
- La création concurrente d’une boutique ne crée qu’un profil vendeur. Les contrôles de commande, messagerie, suspension et incompatibilité livreur reconnaissent aussi ces vendeurs.

## Vérification et limites

Les tests utilisent exclusivement des données synthétiques et MongoDB local jetable. Aucun envoi réel, changement Railway, accès en écriture à la production ou migration n’est nécessaire pour développer ce candidat.

Les nouveaux tests backend couvrent les transitions, les droits, l’historique conservé, la boutique concurrente, la vente directe, les participants de messagerie, les liens invalidés et l’isolation du flux. Les tests JavaScript couvrent les événements fragmentés, la reconnexion, l’expiration, la fermeture et les parcours navigateur.

Les nouveaux contrôles sont intégrés au workflow existant sans modifier ses seuils. Les résultats définitifs doivent être associés au SHA du candidat ; une compilation locale ne prouve pas un déploiement HTTPS.

Échecs de laboratoire conservés : premier démarrage Mongo avant élection du primaire ; première suite sans les variables de compatibilité de CI ; contrôle standalone lancé par erreur contre le replica set ; premier navigateur de développement bloqué par l’optimisation des dépendances ; chemins de navigateurs absents. Ces exécutions ne sont pas comptées comme des validations réussies.

## Déploiement à préparer après validation

Le changement doit d’abord viser uniquement les services API et Web staging existants, épinglés au SHA validé. MongoDB, volumes, secrets et données existantes restent inchangés. Aucun seed ni migration n’est ajouté. L’application du patch Railway exige l’approbation distincte du propriétaire. Les nouveaux parcours devront ensuite être vérifiés en HTTPS avec les seules fixtures dédiées autorisées.

La production reste hors du périmètre d’application de cette branche jusqu’à validation et autorisation distinctes. Le précédent échec Lighthouse du socle n’est pas effacé par ces tests fonctionnels.
