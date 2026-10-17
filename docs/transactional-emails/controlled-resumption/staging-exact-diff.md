# Diff staging préparé — non appliqué

Auteur : Jonathan Kakesa. Projet bc40e22f-b963-46fa-a64e-240f3aa954cd, environnement 0fea37a0-e334-4963-952e-d99ca7523ffd.

Inventaire en lecture seule : trois services SUCCESS, aucun changement en attente. API actuelle 2806d719bf0edbdc31ebd32ab0887e1fb4dc40cb ; AUTH_MODE=sandbox ; aucune variable Resend/outbox/webhook présente. Mongo deployment a72b1bb3-5a19-4049-b1fe-e1067ae6cd3f ; volume b0f66ec2-2328-4b12-aecb-47847c6d5733, 1024 MB, /data/db. Aucune modification Mongo proposée.

## Changements à soumettre seulement après CI vérifiée et autorisation

- API 3a11fecf-70e7-4ba3-8744-d0156b9f7e6c et Web 5a36eb00-531d-4aae-be1a-f8c63f241da3 : branche feature/afrimarket-transactional-emails, SHA exact du candidat vérifié à renseigner après publication. Ne pas utiliser HEAD sans relecture.
- API AUTH_MODE : sandbox → production, indispensable avant démarrage pour éviter seed_all.
- API EMAIL_MODE : absent → disabled.
- API BACKGROUND_JOBS_ENABLED : absent → false. Le scheduler existant écrit même quand les e-mails sont désactivés : refresh FX au démarrage, expiration des invitations, housekeeping. Le nouveau verrou empêche son lancement en validation. Valeur par défaut true pour conserver le comportement des autres déploiements ; toute valeur autre que true le désactive.
- API EMAIL_FROM : AfriMarket <notifications@afri-market.app> ; EMAIL_REPLY_TO : support@afri-market.app ; FRONTEND_URL : https://afrimarket-web-staging-staging.up.railway.app ; EMAIL_LOGO_URL : https://afrimarket-web-staging-staging.up.railway.app/assets/email/afrimarket-official.png.
- Aucun secret de production copié. Aucun secret fournisseur nécessaire pour cette inspection en mode disabled. La clé dédiée Resend, la signature webhook staging et EMAIL_OUTBOX_KEY propre au staging seront à créer/configurer par une autorisation distincte avant les essais e-mail.

Préserver toutes les autres variables, les références Mongo, DB_NAME, volume, root directory, domaines, CORS et commandes existantes après vérification du diff effectif. Pas de migration/index/seed/fixture dans cette phase. Consulter les autres changements en attente juste avant soumission et refuser tout périmètre inattendu. Le SHA et ce diff ne sont pas encore soumis au connecteur.

## Contrôles après application approuvée

API puis Web : status SUCCESS et SHA exact dans métadonnées/health ; logs sans seed, sans scheduler started ni tentative fournisseur. Health Mongo ok, OpenAPI avec routes communications ; appels e-mail désactivés. Logo HTTPS image/png et hash officiel. Les endpoints publics de lecture seulement peuvent être parcourus ; ne pas appeler les GET qui créent un profil ou toute route à effet de bord. Aucune connexion client de production ni API fournisseur POST. Les performances locales/CI ne remplacent pas les mesures HTTPS.

## Essais réels ultérieurs, accord distinct

Autoriser seulement les nouvelles fixtures QA synthétiques dédiées et les secrets staging, puis mode test. BACKGROUND_JOBS_ENABLED=true réactiverait aussi tous les autres jobs : ne pas l’activer implicitement. Choisir explicitement soit un worker e-mail dédié limité, soit une exécution contrôlée du worker dans l’environnement synthétique, après revue des jobs et approbation des écritures correspondantes. Pas de suppression de données existantes. Les règles delivered/accepted, signatures, rebonds/plaintes, suppressions, reprises et rejeux du plan précédent restent applicables.
