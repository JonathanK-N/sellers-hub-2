# Rapport de finalisation — AfriMarket

Auteur : Jonathan Kakesa (JonathanK-N). État au 12 octobre 2026.

## Décision actuelle

**NO-GO production.** Le candidat est validé en CI et en navigateur sur environnement synthétique local. Le staging Railway ne correspond pas encore au candidat : le contrôle automatique du connecteur a refusé l’application, malgré l’autorisation explicite du propriétaire, et celui-ci ne peut pas appliquer le patch manuellement actuellement. Aucun résultat HTTPS du candidat n’est déclaré PASS. Aucun déploiement, conversion, migration ou seed de production n’a été exécuté.

Ce rapport couvre les travaux effectués et les preuves disponibles. Il ne constitue pas un rapport de lancement réussi. La mission reste ouverte pour les opérations et validations bloquées ci-dessous.

## Candidat et provenance

- Dépôt : JonathanK-N/sellers-hub-2 ; branche release/afrimarket-production-launch ; PR brouillon [n°4](https://github.com/JonathanK-N/sellers-hub-2/pull/4).
- Source immuable : c492c70126a2ec9da71844c2d313df8e675c2ffb ; tag nouveau v1.1.0-direct-rc.1. [Release brouillon](https://github.com/JonathanK-N/sellers-hub-2/releases/tag/untagged-1de09333980cc6290109), quinze assets et leurs digests vérifiés dans release-proof.json ; brouillon et prerelease conservés.
- Build CI : 5abd42d068632c7cb5c172d45c2c7746aae69798. Le SHA de build est le commit de fusion technique de la PR ; les métadonnées des artefacts indiquent aussi le SHA source.
- [Run 38257880212](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38257880212) : onze jobs réussis et onze archives téléchargées, vérifiées par SHA-256 GitHub ; contrôles des fichiers SHA256SUMS et de la provenance lorsqu’ils sont présents.
- Web ZIP : a5b0aa6e2b4489a7b63f3ae2177fdf461928803b5a683a38c001e441075faa8d.
- APK debug : 229b2f407766d92bc16a425c669adf5adcc71e4f34afb06f91ed5b9fde065069. Android version code 5, version 1.1.0-direct-rc.1-debug. Aucun APK release signé ni test sur appareil physique certifié.
- Backend ZIP exact : d28e79ca7b564a0b3d1d482a661dc6e59b98c53add8b8c1c0bf502b4b6ded912.
- Web/PWA et Android debug ciblent l’API staging. Ils ne sont pas des builds de production.

Les PR 1/2/3, anciens tags et releases sont préservés. Le bundle Git privé antérieur est conservé ; il ne remplace pas une sauvegarde métier. Les changements documentaires et les outils de répétition ajoutés après le SHA candidat ne changent pas les artefacts épinglés.

## Fonctionnement livré

### Paiement direct et commandes

La commande réserve le stock dans une transaction Mongo et utilise une clé d’idempotence. Elle indique un paiement à organiser hors plateforme : escrow non applicable, fonds détenus faux et paiement confirmé par fournisseur faux. Aucun ledger, transaction financière ou crédit de portefeuille n’est créé pour ce parcours. La commission directe est zéro en l’absence de règle approuvée ; aucun solde vendeur payable n’est inventé.

L’acheteur peut déclarer avoir payé ; le vendeur doit cocher un consentement explicite pour déclarer la réception. Les déclarations restent manuelles, auditables et protégées par révision/CAS. Préparation et assignation sont bloquées si la réception n’est pas déclarée ou si un litige suspend le traitement. Les courses désaccord acheteur/assignation sont testées. Retrait et livraison ne convertissent pas ces déclarations en preuve fournisseur.

La livraison directe compte dans l’activité du livreur mais génère zéro crédit financier. Les montants historiques estimés sont distingués des sommes payables. La médiation administrateur clôture un litige avec une note, sans bouton de remboursement ou de libération vendeur. Les remboursements partiels restent suspendus jusqu’à définition de leur règle.

Le checkout affiche la devise native ; les frais CDF ne sont pas ajoutés comme des frais USD. Les paniers à devises incompatibles sont refusés. Le navigateur a révélé un crash sur des variables de conversion supprimées : il a été corrigé et le scénario conservé. Le doublon historique du bouton de litige est supprimé pour les commandes directes.

### Messagerie

Les fils acheteur/vendeur conservent les identifiants historiques. La participation et les droits sur le contexte commande/produit sont vérifiés avant accès. L’administrateur et le livreur ne disposent pas d’un accès implicite aux conversations privées. Limites de longueur, débit, pagination et curseurs bornés sont appliqués ; les comptes suspendus/inactifs ne peuvent pas envoyer.

Une réponse perdue puis un rechargement/retry conserve la clé client et produit un seul message Mongo. Le texte XSS reste du texte React, sans exécution. La pagination de 125 fixtures anciennes, plus les messages réellement envoyés, ne perd ni ne duplique de ligne. Le polling conserve la position de lecture et les pages déjà chargées. Une réponse HTTP 401 efface la session et ferme immédiatement l’accès à une conversation ouverte.

### WhatsApp et confidentialité

Le lien public exige un numéro professionnel vérifié, normalisé et explicitement accepté. Les anciens numéros personnels ne deviennent pas publics par défaut. Le lien de commande contient sa référence publique, sans téléphone acheteur ni code de remise. Les preuves OTP et données KYC ne sont pas exposées dans les vues publiques identifiées. Aucun message WhatsApp réel n’a été envoyé lors des validations.

Les OTP sont protégés, limités et consommés de manière conditionnelle. Une erreur du fournisseur SMS ne devient pas une fausse réussite. L’OTP synthétique est limité au mode sandbox. Les codes de remise ne sont pas fournis aux dashboards vendeur/livreur.

### CinetPay

L’intégration est conservée derrière CINETPAY_ENABLED=false. Les actions financières historiques restent désactivées par LEGACY_FINANCIAL_ACTIONS_ENABLED=false. Le paiement direct n’initialise pas de paiement fournisseur et n’accepte pas une preuve webhook comme confirmation. Aucune transaction CinetPay réelle n’est certifiée ni nécessaire pour autoriser le parcours direct.

## Conservation de la production

Production identifiée : projet 7cf04965-3d75-4965-9e76-cd33c3b716c5, environnement 7382f536-2e97-4ac4-ba22-ff7dd1e06ecf. API 69e4d050-47d4-4e24-8d0d-d47807f4b99a ; Web 708bc9c5-90ae-47e7-a2ab-8c718c44b2ed ; Mongo 8807024a-a89f-4c55-8b4b-fb49641c58c3. API/Web existants déployaient main/6722492d85e0f8646ebe03c9b841c4a0e3611449 lors de l’inventaire. Domaines afri-market.app et afrimarket.up.railway.app ; API sellers-hub-2-production.up.railway.app.

Mongo 8.0.32 authentifié, standalone, volume existant 5000 MB. Inventaire en lecture seule : 23 collections, 33 utilisateurs, 6 vendeurs, 23 produits, 28 commandes. Le rapport de schéma ne contient aucune valeur de document ni secret.

Sauvegarde autorisée avec pause temporaire des écritures : première tentative arrêtée sur l’authentification de mongodump, source déverrouillée et vérifiée ; correction de la base d’authentification implicite. Deuxième tentative réussie : pause 12,5 secondes, export 7,97 secondes, restauration 3,03 secondes. Les documents, IDs et index des 23 collections sont identiques. Le déverrouillage et le ping ont été vérifiés indépendamment.

Archive AES-256-GCM de 34 819 octets, SHA-256 7a409f26c720e840509f9e7e66dc770f8e4f65086ae239f23732a8c3db24c9bb. Archive plaintext uniquement en mémoire pendant l’export/restauration. Archive, clés et fichiers Mongo restaurés sont dans un répertoire privé protégé hors dépôt ; ils ne sont pas des assets GitHub. Le backup couvre la base métier, pas une exportation des bases système admin/config.

Configuration API/Web/Mongo sauvegardée séparément, chiffrée et déchiffrée en mémoire pour comparaison : 4238 octets, SHA-256 a79570c8d549e98c9317ac9beeb42c94cd2bbcfd106551a8d832a5e755f59c24. Aucun secret de production modifié. RPO : instant de la pause ; RTO applicatif global non mesuré. Aucune copie distante indépendante ni exercice global de reprise applicative n’est certifié.

Sur la copie restaurée protégée : migrations additives PASS, 23 collections métier inchangées, dix nouvelles collections vides et nouveaux index vérifiés. Sur une autre copie privée hors ligne : conversion authentifiée en replica set, transactions avec compte limité, refus anonyme, redémarrage persistant et retour en standalone PASS ; documents/indexes conservés et archive chiffrée initiale inchangée. Ceci ne vaut pas approbation ni mesure d’indisponibilité pour la production.

Le healthcheck de la production existante était degraded à cause d’un import get_db absent dans son ancien code. Le ping Mongo et la lecture publique produits HTTP 200 fonctionnaient. Le candidat corrige déjà cet import ; ne pas attribuer ce défaut préexistant au backup.

## Tests et performance

Backend Linux : **123 tests PASS, zéro échec, erreur ou skip**. Inclut régressions historiques, 9 tests messagerie, 17 tests directs, 6 tests contacts/WhatsApp et vérifications de démarrage sans seed production. Les contrôles HTTP couvrent inscription/OTP/login, rôles, suspension et expiration. Les avertissements WMI locaux Windows ne servent pas de preuve de réussite Linux ; la CI donne cette preuve.

Navigateur exact c492c701/build5abd42d : **25 contrôles PASS** sur API réelle/Mongo replica set synthétiques loopback. Quatre rôles, checkout et livraison, médiation, perte de réponse et reprise, XSS, pagination, expiration et zéro document financier. Formats 390/768/1440 vérifiés pour le chat. Le scheduler est désactivé dans le lanceur de test pour interdire les appels externes ; les routes et transactions métier restent réelles. Fixtures locales supprimées après validation. Aucun compte client réel utilisé.

PWA : **6 contrôles PASS** sur artefact exact, migration cache v9→v10, conservation des caches tiers, landing offline, API offline 503, route lazy indisponible lisible et reconnexion. Installation OS/appareil physique non certifiée. Android : build debug et émulateur CI PASS.

Sécurité : Gitleaks historique et source, audits dépendances Web/backend et SAST CI PASS, seuils et règles conservés. Seulement trois empreintes historiques précisément autorisées sont ignorées : une clé d’idempotence synthétique et deux faux positifs sur l’argument bind loopback. Aucune exclusion générale de fichier/règle ni réécriture d’historique. Le nouveau script de répétition de topologie a passé le scan source local ; il ne faisait pas partie des onze jobs du candidat épinglé.

Performance mobile landing locale, trois mesures sur même runner : performance 97, accessibilité 100, bonnes pratiques 96, SEO 100 ; LCP 2,414–2,425 secondes, TBT 3–5,5 ms, CLS 0,00365. **PASS pour cette mesure locale uniquement.** Le contrôle de contexte HTTPS constate artifactMatchesStaging=false. Les sept pages HTTPS exigées — accueil, produits, panier, commandes, messagerie, vendeur, administrateur — restent BLOCKED pour le candidat ; aucun score de l’ancien staging n’est réattribué au nouveau build.

## Staging et refus d’application

Projet AFRIMARKET-STAGING-20261010, environnement staging. Patch 6d13f9a6-4924-4c69-92e3-d351404d5136 relu : 24 changements, trois services existants épinglés au SHA candidat, volume neuf 1024 MB, aucune suppression déclarée, réseau privé conservé. API en paiement direct, CinetPay/actions financières OFF, seed OFF ; compte Mongo limité à afrimarket_staging_synthetic. Mongo Dockerfile 8.0.32, authentification et replica set privé à un membre.

Deux mots de passe aléatoires distincts de 48 caractères configurés dans des variables standard avec autorisation explicite, sans déploiement et sans exposition des valeurs. Elles restent lisibles par les administrateurs autorisés du workspace ; elles ne sont pas scellées. Les données staging étant synthétiques et éphémères, leur régénération a été autorisée si l’export reste inaccessible. L’essai SSH en lecture seule a échoué faute de clé locale, sans commande Mongo distante exécutée.

Le propriétaire a explicitement autorisé le patch complet. L’outil accept_deploy a néanmoins retourné : « Cancelled — the user did not approve this action. No changes were made. » Le patch reste STAGED, et le propriétaire a ensuite indiqué ne pas pouvoir l’appliquer actuellement. Aucun contournement par CLI/API ou connexion live. L’application staging et les preuves HTTPS sont donc BLOCKED.

## Les 22 livrables

| N° | Livrable | État et preuve |
|---|---|---|
| 1 | Cartographie GitHub/Railway | PASS : github-baseline.json, deployment-plan.md et identification ci-dessus |
| 2 | Inventaire production | PASS : mongo-production-inventory.json, services/domaines/SHA identifiés |
| 3 | Conservation Mongo | PASS au snapshot : documents/IDs/indexes comparés dans production-backup-proof.json |
| 4 | Backup et restauration | PASS : production-backup-proof.json ; archive/clé privées hors Git |
| 5 | Migration | PASS sur copie : migration-copy-proof.json ; migration production non exécutée |
| 6 | Messagerie | PASS API et navigateur synthétiques ; HTTPS candidat BLOCKED |
| 7 | WhatsApp | PASS permissions/consentement/liens inspectés ; aucun envoi externe |
| 8 | Paiement direct | PASS transactions/API/navigateur quatre rôles ; production BLOCKED |
| 9 | CinetPay préservé OFF | PASS flags et tests ; paiement fournisseur réel non certifié |
| 10 | Tests automatisés | PASS : onze jobs, 123 tests backend ; candidate-ci-manifest.json |
| 11 | Tests fonctionnels | PASS synthétiques : candidate-browser-proof.json et loop10 ; HTTPS BLOCKED |
| 12 | Sécurité | PASS sur candidat : artefacts secrets-scan, backend-security, web-security ; faux positifs documentés |
| 13 | Performance | PASS landing locale ; sept pages HTTPS candidat BLOCKED |
| 14 | Staging | Patch prêt/autorisé ; application BLOCKED par contrôle du connecteur |
| 15 | PR | PASS : PR brouillon n°4 documentée ; aucune fusion |
| 16 | Release GitHub | Brouillon du candidat v1.1.0-direct-rc.1 ; aucune publication finale production |
| 17 | SHA source/build | PASS : c492c701 / 5abd42d, métadonnées Web/Android |
| 18 | Manifeste artefacts | PASS : candidate-ci-manifest.json et hashes de release |
| 19 | Déploiement production | BLOCKED / non exécuté |
| 20 | Post-déploiement | BLOCKED / non exécuté ; inventaire et lecture préexistante ne remplacent pas ce contrôle |
| 21 | Rollback | PASS topologie sur copie ; rollback applicatif sur staging BLOCKED, rollback-plan.md |
| 22 | Décision finale | NO-GO production ; ce rapport conserve les limites et les gates manquants |

## Reprise nécessaire

1. Débloquer l’application du patch staging par le contrôle Railway ou par une opération du propriétaire dans son tableau de bord. Ne pas contourner le refus automatique.
2. Vérifier SHA/version/logs/authentification, transactions et persistance sur staging, puis les parcours HTTPS et les sept pages aux seuils demandés.
3. Préparer une conversion Mongo production non destructive sur le volume existant avec compte applicatif limité, coût/indisponibilité mesurés et approbation distincte. Le script staging sur volume neuf ne doit pas remplacer une procédure de conversion de la base métier.
4. Tester un rollback applicatif qui reste compatible avec les commandes directes ; ne pas réactiver les anciennes routes financières sur ces commandes ni écraser les écritures récentes avec le backup.
5. Seulement après ces gates : plan final API/Web/configurations, approbation production, déploiement compatible, contrôles non destructifs et rapport post-déploiement. Aucun faux compte/commande dans les comptes clients réels.
