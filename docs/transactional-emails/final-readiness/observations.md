# Reprise de la PR #15 — validation avant production

Auteur : Jonathan Kakesa. Observations du 16 octobre 2026, heure de Toronto.

## Provenance et limites

Candidat repris exactement : a8b2e3c6a8b863d265ce57d63c5ea162392d55a5, PR #15 ouverte en brouillon, non fusionnée. main et l’API production annoncent 34096b1e9eba13681b84e8d1f44d3264571bb6e8. Les audits distants sont en lecture seule. Aucun envoi Resend, test webhook réseau, déploiement, migration, seed, changement de variable/DNS ou modification de données production n’est effectué.

## Resend et Railway

- Huit variables requises sont présentes. La clé actuelle fonctionne pour les lectures Resend (HTTP 200).
- EMAIL_FROM, EMAIL_REPLY_TO, FRONTEND_URL, EMAIL_LOGO_URL et EMAIL_MODE contiennent une enveloppe JSON indésirable (guillemets et virgule). Leur correction n’est pas appliquée sans autorisation. Le mode attendu reste exactement disabled ; la valeur actuellement saisie n’est pas reconnue comme telle par le candidat.
- EMAIL_OUTBOX_KEY est une clé Fernet valide, testée uniquement par chiffrement/déchiffrement local d’une fixture. Aucune file production existante : zéro message et zéro jeton e-mail observés.
- RESEND_WEBHOOK_SECRET correspond au secret récupéré en lecture dans Resend. La signature réelle configurée a été testée localement avec le vérificateur du candidat, sans réseau ni écriture de base.
- afri-market.app est maintenant présent dans le compte connecté, statut partially_verified. DKIM et les deux enregistrements SPF sont verified ; l’enregistrement MX de réception est pending. Les capacités sending et receiving sont enabled. Ne pas assimiler la vérification de l’envoi à celle de la réception.
- Le DNS public ne fournit pas de MX racine ou de DMARC au moment du contrôle. La réception de EMAIL_REPLY_TO n’est donc pas prouvée. Aucun DNS modifié.
- Un webhook enabled pointe vers le bon hôte backend et /api/communications/resend/webhook. Les événements pertinents sont sélectionnés, ainsi que des événements additionnels ignorés par le candidat. Le backend actuellement déployé ne contient aucune route communications : aucun test de livraison ou webhook de cette PR n’est validé sur ce service.
- L’URL frontend normalisée répond HTTP 200. Le chemin du logo officiel répond HTTP 200 mais avec text/html et un contenu différent de l’image : c’est le fallback SPA, pas un logo hébergé. L’asset de la PR devra être déployé et vérifié avant activation.
- Le compte actuel liste une seule clé active, créée récemment. Sans identifiant de l’ancienne clé exposée et confirmation de son périmètre de compte, sa révocation n’est pas prouvée. Aucune ancienne clé n’est demandée ou publiée.
- Les trois services production et les trois services staging sont online, sans changement en attente observé. Mongo et ses volumes restent inchangés. Le service Mongo staging n’a pas de proxy TCP public ; aucune exposition supplémentaire n’est créée pour l’audit.

Point de vigilance confirmé par le code du SHA production : son ancien email_service.py ne lit pas EMAIL_MODE. Cette variable seule ne garantit donc pas la désactivation de ce transport existant. Aucun essai ne le traverse ; toute opération sur celui-ci exige une autorisation production distincte.

Preuves : provider-readonly.json et mongo-readonly.json. Aucune valeur secrète, adresse de client ou identifiant de livreur dans ces rapports.

## MongoDB et affiliations

Le hello production confirme standalone : ni replica set ni mongos, donc transactions requises non disponibles. Aucun essai de transaction avec écriture n’est exécuté sur cette base. La conversion éventuelle doit être non destructive, précédée d’une sauvegarde fraîche/restauration et d’une autorisation distincte.

Trois profils livreurs actifs existent, tous sans affiliation enregistrée ; zéro référence boutique orpheline, zéro doublon de profil et zéro compte livreur sans profil. Aucun profil n’est modifié. Le nouveau contrôle d’affiliation les refuserait à l’assignation : le propriétaire doit décider réseau ou boutique pour chaque cas avant toute migration approuvée. Aucune affiliation n’est inventée pour faire passer les tests.

## Corrections apportées au candidat

1. Un EMAIL_MODE mal formé coupe l’émission avant les hooks métier. La validation stricte continue à le signaler invalide ; aucune correction silencieuse de configuration. Les parcours e-mail retournent 503 plutôt qu’une erreur interne dans ce cas. Les notifications métier ne doivent pas échouer uniquement à cause de cette saisie invalide.
2. Prise en charge du webhook email.suppressed : statut terminal, suppression persistante et blocage du message suivant. Les signatures, délais et déduplications existants restent obligatoires.
3. Chargement différé du composant Toaster, sans délai artificiel, et du tiroir panier uniquement à son ouverture. Le hero et ses fonctionnalités ne sont pas masqués. Le JavaScript initial passe de 287,98 à 252,09 Ko, soit de 90,68 à 81,30 Ko gzip. Les modules des routes privées et les données privées restent séparés.

## Tests et mesures avant CI du nouveau candidat

- Suite backend locale équivalente CI : 172 PASS, cinq avertissements de dépréciation conservés. Replica set/standalone locaux isolés et failpoints ; aucun test ignoré. backend-results.xml.
- Suite e-mail : 47 contrôles, dont les 26 rendus HTML/texte, sécurité, invitations, reset, file, chiffrement, signatures, suppressions et configuration invalide. email-results.xml.
- Compilation Web réussie ; les seuils, profils Lighthouse et règles de sécurité ne changent pas.
- Contrôles de graphe des routes et service worker : PASS. Les autres régressions frontend restent à confirmer dans la CI du commit publié.
- La tentative locale de référence a été interrompue avant résultat exploitable ; elle n’est pas présentée comme une mesure valide.
- Trois mesures locales du correctif : LCP 3807,60 / 3577,93 / 3299,27 ms, toutes FAIL. TBT 647 / 1193 / 646,5 ms, également au-dessus du seuil. Les benchmarkIndex locaux 272 / 239 / 336,5 sont enregistrés, sans changer la simulation ou le seuil pour compenser la machine. Ces échecs restent visibles même si une autre exécution réussit.
- La trace confirme l’élément LCP : section.premium-hero > div.premium-hero-photo > picture > img. Les coûts de script, de mise en page et le délai de rendu de cette image restent mesurés dans lighthouse-corrected.json. Les résultats CI du nouveau candidat détermineront si la correction suffit au profil standard ; ne pas annoncer le LCP corrigé sur la seule réduction du bundle.

## Décision à ce stade

NO-GO production. Restent : résultats CI du nouveau candidat, budget Lighthouse, syntaxe des variables, réception/domaine, hébergement réel du logo, routes webhook déployées, révocation de l’ancienne clé, Mongo transactionnel et affiliations existantes, puis essais Resend autorisés sur staging.

Le plan staging-approval-plan.md prépare les étapes isolées et les autorisations séparées. Aucun envoi réel, déploiement ou changement de production n’est autorisé par la seule présence des nouvelles variables.

Références : [domaine Resend](https://resend.com/docs/api-reference/domains/get-domain), [webhooks Resend](https://resend.com/docs/api-reference/webhooks/list-webhooks), [suppression des e-mails](https://resend.com/changelog/email-suppression-visibility).
