# AfriMarket — rapport complet de stabilisation, phase 2

Auteur : Jonathan Kakesa (JonathanK-N). Date : 11 octobre 2026, America/Toronto.

Décision : **NO-GO pour la production**. La candidate améliore le produit, ferme plusieurs vulnérabilités reproduites et dispose de builds Web et Android testables. Elle ne constitue pas encore une certification des paiements, de la restauration MongoDB ou de la résistance des écritures financières aux interruptions.

## Références et périmètre

- Phase 1 préservée : `dd6d186a15abc88dfdc93702dbe0e91854639a4a`, tag `release/afrimarket-phase1-final-20261010`.
- Candidate compilée de phase 1 : `890d8e76341c3bb08f3d7452e7ecf87e08d222dd`. Les deux ZIP Web/Android ont été revérifiés par SHA-256 ; preuve `release-evidence/phase2/phase1-artifact-verification.json`.
- Travail de phase 2 : branche `stabilization/afrimarket-phase-2`, [PR #2 en brouillon](https://github.com/JonathanK-N/sellers-hub-2/pull/2), base `fix/restore-original-green-theme`. [PR #1](https://github.com/JonathanK-N/sellers-hub-2/pull/1) conservée.
- Tag immuable : `v1.0.1-green-rc.2`.
- Version : `1.0.1-green-rc.2`, Android debug `1.0.1-green-rc.2-debug`, versionCode 3, applicationId `cd.cognito.afrimarket.staging`.
- Candidate source : `9176e82debf2b35f7262d64416fa9cb5e983726b`. [CI candidate](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38146644352).
- [Web staging](https://afrimarket-web-staging-staging.up.railway.app), [API staging](https://afrimarket-api-staging-staging.up.railway.app/api/health), [projet Railway staging](https://railway.com/project/bc40e22f-b963-46fa-a64e-240f3aa954cd).

Les tests utilisent des comptes, boutiques, produits et commandes synthétiques. Aucun paiement, remboursement ou décaissement externe réel n’a été exécuté. Aucun secret ni export de données personnelles n’est inclus dans les preuves ou les artefacts.

Aucun déploiement de production n’a été déclenché pendant cette reprise. L’inventaire initial indiquait un backend `6722492d85e0f8646ebe03c9b841c4a0e3611449` et un frontend `0e24300a3fa0cba3dcf8896e4617d9dec5fd3e84`. La relecture finale Railway indique désormais `main` au SHA `6722492d85e0f8646ebe03c9b841c4a0e3611449` pour les deux services, avec des déploiements datés du 10 octobre en soirée Toronto. Cette différence est consignée ; son origine n’est pas déduite de l’inventaire. Le tip ui-ux `83be265` n’est pas la référence active.

## Tableau des douze domaines

Le statut global de chaque domaine tient compte du périmètre demandé, y compris les contrôles encore manquants. Un build réussi ne remplace pas une validation métier.

| Domaine | État initial | Corrections | Résultat final | Preuve |
|---|---|---|---|---|
| Identité visuelle | Palette restaurée, classes de fond doux invalides | 36 fichiers JSX corrigés, vert historique conservé, petits textes et boutons contrastés | PASS | Validateur statique, captures 390/768/1440 dans `phase2/browser-final` |
| Performance | Phase 1 : 43/100 ; comparaison CI initiale médiane 73/100, LCP 7,09 s | Routes et modale différées, animations natives, polices locales, image responsive anticipée puis embarquée | FAIL | Cycle final identifié : 98 local / 90 HTTPS médians ; LCP HTTPS 3,163 s >2,5 s, pas de sélection du meilleur essai |
| Accessibilité | Lighthouse 94/100, contrastes et landmark manquants | `main`, boutons nommés, focus visible, associations de couleurs corrigées, mouvement réduit | PASS | Lighthouse 100/100 sur les cycles CI et HTTPS déjà exécutés ; navigation modale/Escape |
| Backend | Défauts stock, paiement et permissions reproduits | Réservations conditionnelles, entrées financières bornées, JWT/OTP durcis, états et accès contrôlés | PASS | 53 tests PASS, Mongo standalone et replica set réels, dont QR et recherche littérale |
| MongoDB | Aucun accès de sauvegarde configuré | Procédure de sauvegarde cohérente, chiffrement, restauration isolée et validation préparée | BLOCKED | Confirmation du propriétaire et `mongodb-backup-restore.md` ; aucun dump/restauration exécuté |
| Paiements | Webhook sans configuration pouvait marquer une commande payée | Providers non configurés fermés, aucun faux paiement sandbox, escrow en attente avant paiement | BLOCKED | Refus 503 et tests de régression ; certification fournisseur absente ; remboursement externe NOT IMPLEMENTED |
| Commandes | Doublons de lignes dépassant le stock acceptés ; coordonnées/codes accessibles à un livreur non affecté | Agrégation stock, accès privés, codes masqués, transitions et confirmation avec comparaison atomique | FAIL | Parcours HTTP synthétiques PASS ; atomicité multi-collections après interruption encore non garantie |
| PWA | Tests physiques incomplets, ancienne version à vérifier | Cache v8 limité à l’application, API privées hors cache, récupération des chunks hors ligne | BLOCKED | Upgrade navigateur v7→v8, accueil hors ligne, panier et sessions PASS ; installation OS/mobile non certifiée |
| Android | Ancien APK debug, essais installés incomplets | rc2 compilée, tar CLI et émulateur corrigés, ressources embarquées, cache natif/PWA séparé et attente de rendu bornée | BLOCKED | 10 contrôles émulateur PASS, dont lancement hors ligne et Retour racine ; physique/iOS et ancien→nouveau signer non certifiés |
| Sécurité | 119 vulnérabilités backend ; 8 alertes critiques Web ; fuite commande reproduite | Dépendances runtime corrigées, authentification stricte, uploads bornés, retrait transactionnel, accès fermés | FAIL | Backend audit PASS, critiques Web 0 ; alertes de chaîne build et risque financier d’interruption subsistent |
| CI/CD | Trois builds de phase 1 | Mongo standalone et replica set réels, audits bloquants, SHA-256, émulateur, trois comparaisons Lighthouse | FAIL | Audit Web échoue sans masquer l’échec ; autres résultats détaillés dans rapports |
| Staging | Environnement isolé existant | Même projet réutilisé, source phase 2, AUTH_MODE sandbox explicite, aucune clé production copiée | PASS | Déploiements staging et health ; Mongo éphémère standalone identifié, retraits fermés sans mouvement |

## Corrections exécutées

### Interface et performance

Les routes métier sont différées ; l’accueil conserve son rendu immédiat et la modale d’authentification ne se charge qu’à l’ouverture. Les compteurs réutilisent un formateur et leur animation repose sur les API du navigateur. Les animations de contenu utilisent IntersectionObserver et Web Animations. Le défilement GSAP/Lenis se charge seulement pour les pointeurs fins sans préférence de mouvement réduit.

L’image de fond garde la même photographie. Trois tailles AVIF avec fallback WebP sont embarquées et le preload HTML reprend exactement le srcset et les tailles du composant. Poppins conserve ses cinq graisses et sous-ensembles ; les fichiers sont locaux et la licence OFL est jointe. Le navigateur n’attend plus la feuille CSS externe Google Fonts pour l’accueil.

La palette reste `#1d9e75`, `#168260`, `#085041`, `#e1f5ee`, `#ef9f27`. Le blanc sur vert clair de marque offre environ 3,39:1 : les petits libellés utilisent désormais le vert hover/dark adapté, sans modifier les valeurs de marque. Les fonds ambre utilisent du texte sombre. La fonctionnalité favoris non disponible présente un bouton désactivé avec une explication ; elle n’est pas déclarée implémentée.

### Commandes et stock

Les lignes portant le même produit sont agrégées avant réservation. Chaque stock est décrémenté conditionnellement si la quantité disponible suffit ; les réservations déjà obtenues sont compensées en cas d’échec ordinaire. Les tests MongoDB réels couvrent les commandes concurrentes et le refus d’un stock insuffisant. Les montants et commissions viennent du backend, indépendamment des montants injectés par le client.

Les vendeurs et livreurs ne reçoivent plus les codes de confirmation de l’acheteur dans les lectures de commandes. Un livreur non affecté est refusé. Un groupe de commande est réservé à son acheteur et à l’administration. La consultation par QR du vendeur ne révèle pas le code de remise. Les confirmations vérifient rôle, mode, paiement, statut et escrow ; une modification atomique de l’état refuse les doubles confirmations ordinaires.

Cette protection ne rend pas transactionnelles toutes les écritures commande/transaction/ledger/portefeuille/litige. Une interruption entre collections reste un risque critique, distinct des tests de concurrence déjà réussis.

### Paiements, retraits et litiges

Les webhooks et providers non configurés refusent l’opération. Une commande Mobile Money non payée conserve `awaiting_payment`/`pending` et `payment_confirmed=false`. La réinitialisation d’un paiement cash déjà libéré ne rouvre pas l’escrow. Les communications de l’interface ne prétendent plus qu’un paiement non confirmé est capturé.

Les retraits utilisent une transaction MongoDB et un verrou de révision du vendeur. Le test sur replica set réel réserve exactement le solde disponible face à 20 demandes concurrentes. Sur MongoDB standalone de staging, la demande retourne 503 et le solde reste identique : aucun repli financier non atomique n’est exécuté.

Conformément à la décision du propriétaire, les remboursements partiels sont suspendus : API 503 avant lecture/écriture financière, bouton admin désactivé. Le remboursement total testé est une écriture comptable interne synthétique ; il n’effectue pas un remboursement chez un prestataire externe.

### Authentification, fichiers et dépendances

Les OTP utilisent une source aléatoire cryptographique et ne sont exposés qu’en AUTH_MODE sandbox explicite. Hors sandbox, l’absence de fournisseur SMS bloque l’opération avant création de données. Les JWT exigent les claims d’accès attendus ; utilisateurs bannis/suspendus et rôles sont vérifiés côté serveur. Les sessions survivent aux déconnexions et aux erreurs temporaires ; une réponse 401 invalide le cache de session. Les appels API sont bornés à 15 secondes.

Les uploads lisent au maximum la limite plus un octet, rejettent SVG/HTML publics, contrôlent le type d’image et limitent les dimensions. Les PDF privés restent un périmètre distinct d’un antivirus. Les tests de validation passent ; le stockage KYC S3 réel reste bloqué faute de configuration staging.

Les dépendances backend actives sont réduites et corrigées, en conservant les imports différés nécessaires. Les alertes backend connues sont passées de 119 à zéro. Les corrections Web couvrent notamment axios, React Router, Capacitor, tar et le serveur statique. La compatibilité tar 7/Capacitor CLI 6.2.2 est contrôlée par un patch postinstall limité à une source/version attendue. L’audit Web conserve ses échecs sur les dépendances héritées de la chaîne CRA/Jest/dev-server.

## Performances finales

Sur un même runner, la médiane locale passe de 68 à 98, le LCP de 7,155 à 2,488 s et le TBT de 55 à 20 ms. Sur le staging HTTPS réellement identifié :90/100, accessibilité100, bonnes pratiques100, SEO100, LCP 3,163 s, TBT 20 ms, CLS 0,000062. Le seuil LCP 2,5 s est donc FAIL sur Railway, même si les autres médianes demandées passent. Tous les essais restent conservés, y compris les résultats moins bons.

## Résultats CI exacts

[run 38146644352](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38146644352), source 9176e82, merge de build 7f01a60 : Web PASS, backend PASS (53 tests), sécurité backend PASS, Android build PASS, émulateur PASS (10 contrôles), job de mesures PASS, sécurité Web FAIL. Le job de mesures confirme leur exécution ; le LCP HTTPS reste FAIL au seuil demandé. Les warnings legacy du build sont conservés et CI=false n’élève pas les warnings en erreurs ; aucun audit en échec n’est masqué.

## Validation et limites

- 18 contrôles commerce HTTP précédents : PASS, dont montants injectés, stock, remise cash, refus mobile non payé et double confirmation.
- 21 contrôles HTTP vendeur/acheteur/livreur/admin récents : PASS, dont attribution, états picked-up/en-route, notification et code invalide.
- 14 contrôles complémentaires dashboards admin/permissions/portefeuille : PASS ; trois tests recherche littérale/limite : PASS.
- Recherche publique de l’accueil : route manquante corrigée, query préservée et liens publics vérifiés dans le navigateur.
- Inscription/OTP/connexion acheteur et livreur : six contrôles PASS. Nouvelle inscription/OTP/connexion/configuration vendeur : quatre contrôles PASS.
- Litige synthétique : ouverture, suspension partielle, comptabilité de remboursement interne, refus de seconde résolution et permission admin PASS.
- Livraison push FCM, SMS réel, provider sandbox, KYC S3, lecteurs d’écran, iOS et téléphone physique : BLOCKED ou NOT IMPLEMENTED selon le rapport détaillé.

Les preuves HTTP ne sont pas toutes des parcours visuels. Le panier est testé dans un navigateur authentifié ; les modifications de quantité recalculent le total, et le shell visité conserve le vert hors ligne. Le test d’upgrade PWA est un test Service Worker dans un navigateur, pas une preuve d’installation dans le système d’exploitation.

## Livrables et exploitation

[Release rc2 en brouillon](https://github.com/JonathanK-N/sellers-hub-2/releases/edit/409717666), avec sources, builds Web/Android, APK installable, rapports, preuves et manifeste SHA-256. Elle reste explicitement NO-GO pour la production.

Rapports associés : [performance](phase2-performance.md), [sécurité](phase2-security.md), [matrice fonctionnelle](phase2-functional.md), [PWA](phase2-pwa.md), [Android](phase2-android.md), [MongoDB](mongodb-backup-restore.md), [notes de release](phase2-release-notes.md), [déploiement](phase2-deployment.md), [rollback](phase2-rollback.md), [blocages](phase2-blockers.md).

APK installable : `AfriMarket-1.0.1-green-rc.2-staging-debug-9176e82.apk`, 8 159 834 octets, SHA256 `3449a4d8db6b3beb51a269c99f2cc46f9b322dcbc4f147c9fcade52b480c7a9d`. Vérification du contenu des builds : 236 fichiers Web et2 fichiers Android, PASS.

Les artefacts compilés et leurs métadonnées identifient à la fois le SHA source de la PR et le SHA de merge utilisé par Actions. Ils ciblent exclusivement l’API staging ; l’APK contient l’interface corrigée et ne charge pas le site de production. Les checksums des ZIP et de leur contenu sont conservés. Les sources historiques et candidate sont archivées séparément ; aucun ZIP source ne constitue une sauvegarde de base de données.

## Décision de mise en production

NO-GO tant que la sauvegarde/restauration, la durabilité des écritures financières, l’intégration paiement et les contrôles de sécurité résiduels ne sont pas résolus. Les succès partiels ne lèvent pas ces conditions. Aucune approbation de production n’est sollicitée sur cette candidate tant que ces risques critiques subsistent.

Après correction et validation de ces conditions, une proposition doit identifier le SHA compilé exact, les résultats CI/E2E/Lighthouse/PWA/APK, la sauvegarde restaurée et le rollback. Un merge, un changement Railway de production, une migration MongoDB ou une publication Android restent soumis à une approbation explicite distincte du propriétaire.
