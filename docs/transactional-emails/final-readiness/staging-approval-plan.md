# Plan de validation Resend isolée — aucune exécution autorisée à ce stade

Auteur : Jonathan Kakesa.

## Périmètre préparé

Réutiliser AFRIMARKET-STAGING-20261010, environnement staging, strictement séparé du projet AFRIMARKET production. Services existants : afrimarket-api-staging (3a11fecf-70e7-4ba3-8744-d0156b9f7e6c), afrimarket-web-staging (5a36eb00-531d-4aae-be1a-f8c63f241da3), Mongo staging (80a726a8-1cd5-4387-9e5d-8cd6c9671d9e). Aucun nouveau service n’est nécessaire. Aucune modification du service Mongo, de son volume, de ses secrets ou des données existantes n’est proposée.

Le SHA exact sera celui du correctif de la PR #15 dont les contrôles auront été relus ; ne jamais déployer le HEAD non vérifié d’une branche. La CI et les mesures locales ne constituent pas une validation du déploiement HTTPS.

## Autorisation A — déploiement API/Web staging

Présenter au propriétaire le diff effectif avant soumission Railway. Modifier uniquement la source API/Web existante vers le candidat exact de feature/afrimarket-transactional-emails. Conserver EMAIL_MODE=disabled. Utiliser AUTH_MODE=production pour éviter le seed automatique du mode sandbox ; ne pas exécuter seed_all, migration ou remise à zéro. Conserver les références de connexion Mongo staging et la base synthétique existante.

Préparer des variables staging correctement saisies, sans guillemets/virgule JSON : expéditeur réel du domaine approuvé, adresse de réponse approuvée, FRONTEND_URL du Web staging et EMAIL_LOGO_URL de son asset officiel. Prévoir une clé de chiffrement et une signature de webhook propres au staging ; ne pas réutiliser les secrets de production. Une clé Resend dédiée avec droits d’envoi limités au domaine est préférable à la clé d’administration production.

L’application de ce diff et toute création de clé/webhook externe nécessitent une autorisation explicite. Après soumission d’une approbation Railway, s’arrêter et attendre ; ne pas contourner une annulation par CLI ou API alternative.

Après application autorisée : vérifier les deux déploiements, leurs SHA, les logs, le health, les routes communications et le logo HTTPS (image/png, hash du fichier officiel). Vérifier la connexion depuis le backend déployé. Aucun envoi tant que le mode reste disabled.

## Autorisation B — essais Resend contrôlés

Autoriser séparément EMAIL_MODE=test sur le seul backend staging, le webhook Resend vers /api/communications/resend/webhook de ce backend, et la création de nouvelles fixtures QA clairement identifiées dans la base synthétique staging. Cette autorisation doit couvrir ces seuls ajouts ; aucune donnée existante ne sera modifiée, supprimée ou régénérée. Les cas d’expiration/réinitialisation/permissions restent aussi testables dans une base locale jetable sans interaction avec les comptes clients.

Seules destinations permises : delivered@resend.dev, bounced@resend.dev, complained@resend.dev. La liste applicative est stricte. Aucun compte client ni adresse réelle ne sert aux essais. Les contenus et références sont synthétiques ; aucun mot de passe, code OTP/livraison ou donnée client dans les messages et journaux.

Vérifier successivement :

1. Enregistrement durable et déduplication de l’événement ; payload chiffré.
2. Acceptation HTTP Resend et conservation de l’identifiant fournisseur ; ne pas conclure delivered.
3. Réception du webhook signé et correspondance avec la ligne de file.
4. Événement delivered du destinataire de test ; aucune preuve de boîte de réception réelle n’est revendiquée.
5. Rebonds, plaintes et email.suppressed : statut terminal, empreinte de suppression, absence de nouvel appel pour les messages ultérieurs.
6. Rejeu signé : aucune duplication ; signature altérée ou expirée : rejet avant écriture.
7. Échecs temporaires et Retry-After via transport simulé, sans provoquer volontairement de dépassement de quota fournisseur ; contenu et clé d’idempotence inchangés, reprise concurrente unique.
8. Résultat ambigu et fenêtre d’idempotence dépassée : réconciliation, aucun renvoi automatique avec une nouvelle clé.
9. Sessions privées, permissions, liens à usage unique, invitations annulées/renvoyées/expirées et affiliations incompatibles.

Conserver les preuves non sensibles : SHA, statuts de file, identifiants de messages/événements, nombres de tentatives et métriques. Ne pas conserver les corps de sécurité déchiffrés dans les rapports. Tout nettoyage ultérieur se limite aux identifiants de fixtures approuvés et nécessite l’accord correspondant.

## Production : autorisations distinctes

Le Mongo production standalone ne supporte pas les transactions requises. Trois profils actifs n’ont pas d’affiliation enregistrée ; aucune affiliation réseau/boutique ne sera inventée pour les rendre admissibles. Préparer une conversion non destructive et un classement validé par le propriétaire, avec sauvegarde fraîche et restauration vérifiée, puis demander les approbations distinctes. Ne rien appliquer dans cette mission de validation.

Les cinq variables production copiées avec une syntaxe JSON doivent être corrigées par une opération séparée et autorisée : EMAIL_FROM, EMAIL_REPLY_TO, FRONTEND_URL, EMAIL_LOGO_URL et EMAIL_MODE. Le mode attendu reste exactement disabled. Les trois secrets présents et valides ne sont pas à remplacer pour cette correction syntaxique.

Le backend production actuel ne lit pas EMAIL_MODE ; ne pas présenter cette variable comme un verrou effectif de son ancien transport. Aucun envoi de test ne doit le traverser. Toute opération visant à garantir l’arrêt de ce transport existant exige un plan et une autorisation de production spécifiques.

Ne fusionner ni déployer ni activer les envois production avant résolution des blocages et approbation explicite.
