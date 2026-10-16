# Dynamic Premium — validation HTTPS réelle

Auteur : Jonathan Kakesa (JonathanK-N). Bilan du 15 octobre 2026, heure client America/Toronto.

## Résultat actuel

**NO-GO production.** Les tests fonctionnels en lecture seule passent. Les sept audits HTTPS indépendants confirment quatre LCP supérieurs à2500 ms. Un correctif de chargement des sessions est préparé dans la PR10 ; il n’est pas déployé.

## Provenance

- Web : 4e28a3dbbc02c75747b2fa1d93b1c94c99840e1b, déploiement ca57bfd3-da83-46f9-b84a-46d1b4cf8577 SUCCESS.
- API : 2806d719bf0edbdc31ebd32ab0887e1fb4dc40cb, déploiement 1a774143-96db-4cb8-a0be-19116988a51f SUCCESS ; health200, Mongo ok, FX no_data.
- Le propriétaire a accepté le SHA Web réellement déployé après vérification du diff : huit fichiers de preuves ajoutés à0118ebd, frontend/backend identiques.
- Cache servi en HTTPS : afrimarket-green-ui-dynamic-v14.
- Run indépendant : [38831072948](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38831072948), outils fa148041668973dfb9e4862213bfcdbd9a20380f. Artefact12016764731 ; SHA256 vérifié et conservé dans https-ci-provenance.json.
- Le runner vérifie le chemin et l’empreinte SHA256 du bundle réellement servi avant mesure. Le SHA des outils de test est distinct du SHA applicatif déployé.

## Sept audits HTTPS sur runner CI

Lighthouse13.5, simulation mobile standard, navigateur neuf pour chaque page, sessions introduites sur robots.txt sans chargement préalable de l’application. Toutes les mutations HTTP sont bloquées avant envoi. Les URL finales sont vérifiées.

| Page | Perf | LCP ms | TBT ms | A11y | BP | SEO | Résultat |
|---|---:|---:|---:|---:|---:|---:|---|
| accueil | 97 | 1814 | 142.5 | 100 | 100 | 100 | PASS |
| produits | 94 | 3038 | 8.0 | 100 | 100 | 63 | FAIL |
| panier | 94 | 2993 | 0.0 | 100 | 100 | 63 | FAIL |
| commandes | 97 | 2353 | 17.0 | 95 | 100 | 63 | PASS |
| messagerie | 93 | 3156 | 0.0 | 100 | 100 | 63 | FAIL |
| vendeur | 93 | 3146 | 0.0 | 100 | 100 | 63 | FAIL |
| administrateur | 99 | 1783 | 0.0 | 100 | 100 | 63 | PASS |

Seuils inchangés : Performance≥90, LCP≤2500 ms, TBT<200 ms, CLS<0,1, A11y/BP≥95, SEO public≥95. Les pages privées restent non indexables : leur SEO63 est attendu ; le contrôle exige is-crawlable=0. Tous les CLS de cette série sont inférieurs à0,002.

Le résumé complet est https-lighthouse-ci-loop1.json. Les rapports authentifiés bruts ne sont pas publiés dans Git ni dans l’artefact CI. Seul le résumé sans données de compte est publié. Trois sessions de test de45 minutes ont été transférées chiffrées sous les secrets GitHub temporaires autorisés ; les trois secrets ont été supprimés après le run. Aucun mot de passe ou secret de signature JWT transféré.

## Contrôles fonctionnels HTTPS

PASS : accueil sans débordement aux largeurs320/390/768/1440 ; réponses publiques produits,FX et vendeurs sans password_hash ou secret OTP ; six routes privées attendues avec leurs rôles et sans erreurJavaScript observée ; APIadmin et vendeur403 pour acheteur ; commandes401 sans session et200 avec acheteur ; liste des conversations200 ; session invalide supprimée et accèsadmin refusé.

PASS : ajout au panier depuis une fiche produit réelle, recalcul du total à l’augmentation et restauration à la diminution, navigation vers le panier. Il s’agit d’un état local au navigateur ; aucune commande n’a été soumise.

PASS : serviceworker v14 actif, aucune API privée dans les caches observés, API hors ligne503 plutôt que réponse en cache. Migration v13→v14 testée sur l’origineHTTPS : ancien worker intercepté seulement dans le navigateur de test, nouveau worker téléchargé enHTTPS, cache tiers conservé. Première lecture trop précoce FAIL conservée ; seconde lecture après activation PASS. Aucun worker hébergé modifié.

PASS : mode paiementdirect=true, fonds détenus par plateforme=false, CinetPay=false, retraits=false et remboursements automatiques=false. Lien WhatsApp réel présent sur la fiche ; aucun envoi ou clic de transfert vers WhatsApp.

BLOCKED par l’interdiction d’écrire : création de compte/produit/commande, déclaration de paiement, envoi de message, accusé de lecture et modification vendeur. Ces scénarios ne sont pas présentés comme validés. La recherche par nom de boutique ajoutée au candidat n’est pas déployée dans l’APIrc.4 ; sa validation live reste bloquée.

## Échecs et corrections du harnais

Les mauvaises URL initiales /orders et /payments/features ont produit405/404. Elles restent conservées dans https-permissions-loop1.json. Contrôles corrigés sur /orders/my et /commerce/features : PASS. Le premier contrôle panier cherchait le bouton sur la liste ; le parcours depuis la fiche est PASS, sans masquer le premierBLOCKED.

Les sept mesures locales sont conservées dans https-lighthouse-loop2.json ; elles échouent toutes. L’indice CPU local varie de51,5 à299,5, contre3433–4265 en CI. Cela explique une forte perturbation de mesure, mais ne justifie pas d’effacer les échecs. La CI a confirmé quatre défauts LCP réels malgré un TBT faible. Le premier accueil local partiel est également conservé dans loop1.

## Diagnostic et correctif préparé

Produits, Panier, Messagerie et Vendeur attendent la vérification de session avant rendu. Le code déployé charge d’abord le chunk Axios puis appelle /auth/me ; cette requête se trouve en série avec un téléchargement supplémentaire. Les sous-parties LCP et les cascades de ressources sont conservées dans le résumé.

La correction utilise un transport GET natif pour /auth/me : aucun cookie, aucun cache, délai maximal15 secondes. Les gardes de rôles restent en place et les401/403 suppriment toujours la session. Axios reste utilisé par les autres API privées. Les tests couvrent les refus HTTP avec corps nonJSON et la panne réseau ; une régression bloque volontairement le chunk Axios et exige que la session soit déjà vérifiée.

Le gain final n’est pas encore certifié : le candidat corrigé doit passer les régressions, être soumis à approbation Web staging puis subir à nouveau les sept auditsHTTPS. Aucun changement d’API, de secrets de service, de Mongo/volume/données ni de production n’est proposé. Aucun PR n’est fusionné.

## Candidat correctif vérifié

SHA838cc9523267be74561edd9b395d46615b2fad0a :12 jobs CI réussis,27 contrôlesUI PASS dans Chromium/Firefox/WebKit, régression du chunk Axios bloqué PASS. Trois audits publics de preview : performance97/97/97,LCP2276/2263/2255 ms,TBT31,5/16,5/17 ms ; ils ne certifient pas les pages privées HTTPS du correctif. Artefact Web :163 empreintes internes vérifiées. Les preuves sont dans corrective-ci et corrective-ci-artifacts.json.

Les contrôles HTTPS reduced-motion et consentement WhatsApp passent aussi : aucune animation active ni smoothscroll avec préférence réduite ; lien présent avec consentement réel, masqué lorsque consentement et vérification sont désactivés uniquement dans la réponse interceptée du navigateur. Aucun vendeur modifié et aucun envoi WhatsApp.

Le plan https-corrective-approval-plan.md demande uniquement un nouveau déploiement du Web staging. Il n’est pas appliqué. Statut final de cette étape : NO-GO production ; approbation du correctif Web requise pour continuer la boucle HTTPS.

Le scan des nouvelles preuves a signalé deux identifiants Git publics sous les champs apiSource/apiSha. Les champs ont été renommés backendRevision avant commit, sans modifier leurs valeurs. Aucune exclusion, règle ou seuil du scanner modifié.
