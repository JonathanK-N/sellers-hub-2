# Validation réelle du staging rc.3

Auteur : Jonathan Kakesa (JonathanK-N).

Décision : **NO-GO**. Le SHA réellement exécuté par API et Web est `ddbbaabc01dda497d05ee3372f41a12503f4fddd`, version `1.1.0-direct-rc.3`. La réponse HTTPS et le contenu SHA-256 du JavaScript Web correspondent à l’artefact CI vérifié. Mongo, son volume et ses secrets restent inchangés ; aucune action de production.

## Mesures HTTPS à froid

Lighthouse 13.5, profil mobile par défaut, nouveau navigateur isolé pour chaque page. Seuils conservés : performance ≥90, LCP ≤2500 ms, TBT <200 ms, CLS <0,1, accessibilité et bonnes pratiques ≥95 ; SEO ≥95 public, pages privées non indexables.

| Page | Performance | Accessibilité | Bonnes pratiques | SEO | LCP ms | TBT ms | CLS | Résultat |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| accueil | 57 | 100 | 100 | 100 | 3975 | 2313 | 0.000000 | FAIL |
| produits | 98 | 100 | 100 | 63 | 2210 | 63 | 0.000054 | PASS |
| panier | 98 | 100 | 100 | 63 | 2161 | 0 | 0.000054 | PASS |
| commandes | 99 | 95 | 100 | 63 | 1674 | 0 | 0.000054 | PASS |
| messagerie | 98 | 100 | 100 | 63 | 2182 | 0 | 0.000054 | PASS |
| vendeur | 98 | 100 | 100 | 63 | 2170 | 0 | 0.000093 | PASS |
| administrateur | 99 | 100 | 100 | 63 | 1678 | 0 | 0.000054 | PASS |

Les six pages privées passent. L’accueil échoue ; aucune moyenne ni mesure ultérieure ne remplace cet échec.

## Vérifications

- 24 parcours métier HTTPS PASS : commandes, stock, déclaration de paiement direct sans mouvement financier, messagerie, reprise après réponse perdue, livraison, litige et liens WhatsApp sans envoi réel.
- 24 contrôles HTTPS de sécurité et permissions PASS : accès non authentifiés et rôles interdits, réponses utilisateurs/vendeurs sans password_hash ni champs OTP, idempotence et annulation, remboursement/retrait désactivés, CORS et consentement WhatsApp. Les comptes et commandes sont exclusivement des fixtures TEST staging.
- 7 contrôles PWA HTTPS PASS : activation v12, purge du cache v11, conservation du cache tiers, absence de cache API/authentifié, réponse hors ligne 503 et redirection après suppression de la session.
- 6 contrôles supplémentaires sur l’artefact exact : deux véritables workers v11 puis v12, migration de cache et retour en ligne. Ce contrôle local ne constitue pas une preuve qu’un ancien worker contrôlait le domaine HTTPS.
- Le premier outil PWA a dépassé sa durée maximale ; cette interruption reste enregistrée séparément. Le cycle suivant a terminé avec succès.

## Diagnostic de l’accueil

Le rapport constate 2603 ms d’évaluation JavaScript et un délai de rendu de l’image LCP. Le chargement de l’image elle-même dure environ 29 ms dans la trace observée ; il ne justifie pas à lui seul le LCP simulé. Un profil indépendant mesure 135 ms pour le premier constructeur Intl.NumberFormat du compteur, mais cette contribution ne suffit pas à expliquer tout le blocage. Une collecte des piles CPU est lancée séparément sur la page publique pour localiser le reste du travail. Aucun correctif applicatif ou nouveau déploiement n’est encore déclaré validé.

## Preuves

Les preuves versionnées sont dans release-evidence/staging-rc3-deployment-verification.json, staging-rc3-lighthouse-ci-cold-loop1.json, staging-https-rc3-business-loop1.json, staging-https-rc3-security-loop1.json, staging-rc3-pwa-https-loop2.json, staging-rc3-pwa-upgrade-ddbbaab.json et staging-rc3-pwa-tool-timeout.json. Les profils détaillés et sessions restent privés hors Git.

La production ne sera préparée pour application qu’après un cycle complet conforme sur le candidat corrigé et une approbation distincte.


## Cycle correctif rc.4 en préparation

Le diagnostic public seul, avec échantillonnage CPU supplémentaire, échoue encore (LCP 3274 ms, TBT 704 ms). Ses métriques servent au diagnostic ; elles ne remplacent pas les sept mesures sans échantillonnage. Les piles sont dominées par l’initialisation du bundle React/Scheduler. Leur attribution native ne permet pas de déclarer une cause unique certaine.

Le coût indépendant confirmé de 135 ms dans Intl.NumberFormat est corrigé uniquement pour les compteurs entiers statiques sur pointeur tactile ou mouvement réduit. Décimales, séparateurs, zéro signé, valeurs non sûres et callbacks desktop sont couverts par les tests de régression. Version rc.4, cache v13 et code Android 8 distinguent le nouveau candidat. Aucun gain Lighthouse HTTPS n’est revendiqué avant son déploiement approuvé et ses sept nouveaux audits.
