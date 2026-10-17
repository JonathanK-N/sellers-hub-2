# Configuration Resend et activation contrôlée

Auteur : Jonathan Kakesa (JonathanK-N).

## Variables du backend Railway existant

| Variable | Usage | État observé / règle |
|---|---|---|
| RESEND_API_KEY | Clé serveur Resend exclusivement | Présente ; ne jamais exposer au frontend ou aux journaux |
| EMAIL_MODE | disabled, test ou live | disabled par défaut ; activation live soumise à autorisation distincte |
| EMAIL_FROM | Nom et adresse d’expédition | Adresse exacte à choisir par le propriétaire, domaine afri-market.app obligatoire |
| EMAIL_REPLY_TO | Boîte de réponse réellement consultée | Adresse exacte à choisir, aucun défaut inventé |
| FRONTEND_URL | Origine HTTPS des liens | À configurer selon environnement ; ne pas pointer des fixtures vers la production |
| EMAIL_LOGO_URL | URL HTTPS publique du logo officiel | Après déploiement Web autorisé, vérifier HTTP 200, type image/png, contenu identique au fichier versionné |
| EMAIL_OUTBOX_KEY | Clé Fernet dédiée au chiffrement des messages et liens dans Mongo | Générer aléatoirement hors Git ; conserver dans le gestionnaire de secrets et la sauvegarde sécurisée |
| RESEND_WEBHOOK_SECRET | Secret de signature du webhook Resend | Secret serveur distinct de la clé API ; jamais dans les URL |

Les noms RESEND_API_KEY et EMAIL_FROM existants sont conservés. Le fallback onboarding@resend.dev est supprimé. Aucun fournisseur SMTP n’est ajouté. Ne pas utiliser cognito-inc.ca comme expéditeur : ce domaine ne correspond pas au domaine retenu.

EMAIL_OUTBOX_KEY est une clé Fernet de 32 octets encodés en base64 URL-safe, générée par le gestionnaire de secrets ou Fernet.generate_key(). Ne jamais la coller dans le chat. Sa perte empêche de déchiffrer les messages en attente ; sa rotation impose un drainage ou un rechiffrement contrôlé de la file, pas une simple substitution.

## Préparation avant toute activation

1. Le propriétaire ajoute afri-market.app au compte Resend approprié et récupère les valeurs exactes SPF/DKIM et le sous-domaine de retour fournis. Le compte audité ne contient actuellement pas ce domaine.
2. Comparer aux DNS existants. Toute modification DNS de production nécessite une autorisation distincte. Définir la politique DMARC avec le propriétaire du domaine ; aucune politique n’est imposée automatiquement.
3. Attendre la vérification effective dans Resend. Choisir les deux adresses réelles EMAIL_FROM et EMAIL_REPLY_TO. Vérifier l’accès à la boîte de réponse.
4. Préparer un backend/Web staging avec EMAIL_MODE=disabled et une base de test isolée. Vérifier les migrations/additions de collections ; ne pas réutiliser les données clients pour les essais.
5. Configurer les URL HTTPS staging et vérifier le logo. Créer le webhook /api/communications/resend/webhook dans Resend et configurer sa signature après autorisation de cette action externe.
6. Après approbation staging, passer explicitement à test. Les seules destinations admises sont delivered@resend.dev, bounced@resend.dev et complained@resend.dev. Les tests de cette branche utilisent un transport HTTP simulé : aucun appel d’envoi réel effectué.
7. Vérifier la sortie HTTPS du backend vers api.resend.com depuis le service déployé. La lecture réussie depuis la session locale ne constitue pas une preuve de connectivité sortante Railway.
8. Contrôler les événements accepted, delivered, bounced, complained et delayed avec leur signature. Une réponse API 200 ne prouve ni la livraison ni le placement dans la boîte principale.
9. Réaliser une sauvegarde fraîche et restaurable avant activation production. Les nouvelles collections et les clés de chiffrement doivent être couvertes par la politique de sauvegarde.
10. Présenter le diff Railway et demander l’autorisation distincte de configuration/déploiement/activation production. Aucune fusion ou activation automatique dans cette mission.

## MongoDB et collections

email_outbox : _id déterministe, payload chiffré immuable, statut, tentatives, lease, échéance, mode, empreinte destinataire, identifiant Resend. Les clés d’idempotence ne contiennent aucune adresse ou jeton.

email_tokens : empreinte SHA-256 de 32 octets aléatoires, but, destinataire utilisateur, contexte, expiration et consommation. Le jeton en clair n’est présent que dans le message chiffré et le lien transmis.

email_accounts : réservation atomique de l’adresse vérifiée par _id ; aucun changement de rôle automatique. Les anciennes adresses de candidature ne sont pas assimilées à des adresses de compte vérifiées.

email_invitations : propriété boutique/vendeur, état et génération ; renvoi/annulation invalident les anciennes générations. L’acceptation laisse le destinataire acheteur et ouvre le parcours KYC existant.

email_webhooks, email_suppressions, email_rate et email_limits : faits de livraison dédupliqués, suppression après plainte/rebond, limitation globale et quotas de demandes.

Les opérations sensibles utilisent run_transaction et exigent un replica set ou mongos. Aucun fallback non transactionnel et aucune conversion de Mongo production ne sont effectués. La topologie standalone historique reste un blocage à vérifier et à faire approuver séparément avant activation de ces parcours.

Les _id suffisent à la correction des déduplications. Pour le volume futur, préparer séparément les index (status,due_at) et provider_id sur email_outbox, (status,expires_at) sur email_invitations et les TTL sur email_tokens.expires_at et email_limits.created_at. Les TTL ne remplacent jamais les contrôles d’expiration applicatifs. Leur application nécessite une revue de rétention et une autorisation ; aucun index de production n’est créé au démarrage.

## Exploitation

- Worker : une tentative toutes les deux secondes, lease Mongo globale conservatrice d’une seconde ; Retry-After et backoff progressif. Maximum dix tentatives ; panne ou résultat ambigu passe en réconciliation. Après 23 heures depuis le premier essai, aucun renvoi automatique : la rétention Resend annoncée est de 24 heures.
- Ne jamais réémettre manuellement une ligne ambiguë avec une nouvelle clé sans rapprochement avec Resend. La même clé conserve le même contenu chiffré déchiffré, y compris l’expéditeur et les liens.
- accepted n’est pas delivered. Les événements tardifs ne dégradent pas une plainte ou un rebond vers « envoyé ». Une signature invalide ou périmée est rejetée. Un événement valide reçu avant l’enregistrement de l’acceptation retourne une erreur réessayable.
- Les liens sont dans le fragment URL, retiré de l’historique à l’ouverture. Ils ne passent pas dans les journaux HTTP. Pas de contenu des courriels, d’adresse, de mot de passe, de code OTP/livraison, de jeton ou de réponse brute Resend dans les journaux ajoutés.
- Les parcours API et la prévisualisation sont no-store ; le service worker existant ne met pas les API ni les requêtes Authorization en cache. Le rendu administrateur est synthétique et isolé dans une iframe sandbox.
- Aucune preuve Gmail, Outlook, anti-spam ou réception réelle n’est revendiquée par des captures navigateur.
