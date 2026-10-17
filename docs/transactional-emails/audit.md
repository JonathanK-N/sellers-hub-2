# Communications transactionnelles — audit du 16 octobre 2026

Auteur : Jonathan Kakesa (JonathanK-N).

Base de travail : main 34096b1e9eba13681b84e8d1f44d3264571bb6e8.
Branche indépendante : feature/afrimarket-transactional-emails. Aucune fusion, aucun déploiement ni modification des variables ou DNS de production autorisés dans cette étape.

## État observé avant changement

- API de production : health HTTP 200, même SHA que main. Production et Mongo conservés.
- backend/email_service.py utilise déjà HTTPX et l’API REST Resend. Pas de nécessité de SMTP ni d’autre fournisseur.
- Trois appels existants concernent les décisions de candidatures livreurs. Pas de file persistante, de clé d’idempotence, de version texte, de webhook ni de conservation de l’identifiant Resend. Les erreurs journalisent des destinataires et des réponses brutes. Le sender de secours est onboarding@resend.dev.
- Les modèles officiels contiennent douze messages HTML, en tables, avec logo intégré en base64. Ils sont extraits sans modification de la charte et leur logo devient configurable.
- Les comptes sont initialement identifiés par téléphone. Une adresse saisie dans une candidature n’est pas une adresse vérifiée du compte.
- La réinitialisation existante utilise un OTP téléphone. Les JWT ne comportent pas de version de session.
- Les notifications financières disposent déjà d’un contexte transactionnel Mongo et d’une outbox. Les courriels doivent utiliser ce même contexte, jamais un envoi réseau pendant une transaction.
- Le contrôle d’affiliation des livreurs doit être renforcé avant l’activation des invitations boutique.
- La sauvegarde/restauration historique du 12 octobre est documentée dans docs/production-launch/production-backup-proof.json. Elle ne constitue pas une sauvegarde fraîche pour une future activation.

## Resend et DNS : lectures uniquement

La clé configurée permet GET /domains (HTTP 200). Le compte retourne uniquement cognito-inc.ca, vérifié. Il ne contient pas afri-market.app. Le propriétaire a choisi afri-market.app ; aucune adresse EMAIL_FROM ou EMAIL_REPLY_TO n’a été précisée. Aucun envoi d’essai n’a été effectué et aucune arrivée en boîte n’est prouvée.

EMAIL_FROM, EMAIL_REPLY_TO, FRONTEND_URL, EMAIL_LOGO_URL et RESEND_WEBHOOK_SECRET sont absents de la configuration production observée. RESEND_API_KEY existe ; sa valeur n’est pas publiée.

DNS public : un TXT DKIM existe à resend._domainkey.afri-market.app et un TXT SPF à send.afri-market.app. Aucun TXT DMARC n’a été trouvé à _dmarc.afri-market.app. Ces enregistrements ne prouvent pas la vérification du domaine dans le compte connecté. Comparer aux valeurs exactes fournies par Resend après ajout du domaine, puis demander une autorisation DNS distincte si nécessaire.

## Architecture retenue

Resend REST reste le transport exclusif. EMAIL_MODE=disabled par défaut. En mode test, seuls delivered@resend.dev, bounced@resend.dev et complained@resend.dev sont acceptés. Aucune adresse d’expédition n’est inventée. Le mode live nécessite une autorisation de production séparée.

Les événements ont une identité métier stable ; un _id déterministe empêche leurs doublons. Le payload HTML/texte et ses liens sont chiffrés dans Mongo avec EMAIL_OUTBOX_KEY et restent immuables entre tentatives. La file utilise des leases atomiques, des délais progressifs et une limite globale conservatrice. Une ambiguïté proche de l’expiration de la clé Resend passe en réconciliation manuelle.

Une réponse HTTP acceptée signifie accepted, jamais delivered. Les webhooks vérifient les octets bruts, la signature Svix et l’horodatage ; leurs identifiants sont dédupliqués. Les plaintes/rebonds empêchent les nouveaux envois à cette adresse. Les journaux ne contiennent ni corps, ni adresse, ni jeton, ni réponse brute.

Le logo fourni est conservé dans frontend/public/assets/email/afrimarket-official.png. Son URL HTTPS stable doit être configurée et vérifiée après un déploiement autorisé ; sa présence locale ne prouve pas son hébergement.

Références : [idempotence Resend, rétention 24 heures](https://resend.com/docs/dashboard/emails/idempotency-keys), [limites et Retry-After](https://resend.com/docs/api-reference/rate-limit), [vérification des webhooks](https://resend.com/docs/webhooks/verify-webhooks-requests), [signature Svix](https://docs.svix.com/receiving/verifying-payloads/how-manual).
