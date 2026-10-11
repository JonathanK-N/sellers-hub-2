# Rapport complet AfriMarket — Phase 3

Auteur : Jonathan Kakesa (JonathanK-N). Date : 11 octobre 2026.

Décision : **NO-GO production**. Un candidat reproductible et vérifié est disponible pour revue. Les opérations fournisseur réelles, la sauvegarde de production et la validation financière complète sur Railway restent BLOCKED. Aucune production, migration de production, signature de distribution ou fusion n’a été effectuée.

## 1. État initial vérifié — PASS

Les PR 1 et 2 sont des brouillons ouverts, non fusionnés. La phase 2 est à cd08cc50a8378db4c15d5d42c74c386982d58cc9 ; son candidat immuable rc.2 est 9176e82debf2b35f7262d64416fa9cb5e983726b. Les 29 artefacts des deux releases historiques sont conservés et leurs empreintes vérifiées. Quatre correspondances locales phase 1 étaient incorrectes ou absentes : les originaux distants ont été récupérés en espace privé et validés, sans modifier les releases. Preuve : [inventaire GitHub](../release-evidence/phase3/baseline-github.json).

## 2. Branches, SHA et provenance — PASS

Branche : stabilization/afrimarket-phase-3, créée depuis cd08cc5. Candidat applicatif : **058b6a51bf00c4525155b20e1e1a96e939fdfad5**. Tag du candidat : v1.0.1-green-rc.3, fixé au code contrôlé. Le commit de merge technique utilisé par la CI est 624b32d0b2e506c9434f87b122413232ef13cb7e ; les métadonnées conservent séparément sourceSha et buildSha. Les rapports ajoutés après le gel du code peuvent avancer HEAD ; ils ne déplacent pas le candidat. [Métadonnées Web](../release-evidence/phase3/web-release-metadata.json), [Android](../release-evidence/phase3/android-release-metadata.json). Tous les commits de cette phase sont attribués au propriétaire ; aucune réécriture d’historique.

## 3. Sauvegarde Git — PASS

Le bundle privé phase3-before.bundle contient 45 références et a passé git bundle verify. Il préserve branches et historique avant travaux. Il ne contient aucune exportation MongoDB et n’est pas une sauvegarde des données métier. Les fichiers historiques modifiés ou non suivis avant l’intervention sont conservés, dont release-evidence/draft-release-result.json.

## 4. Architecture MongoDB — PASS préparatoire / BLOCKED Railway

La production utilise un volume 5 GB et une commande sans --replSet ; un hello authentifié de production n’a pas pu être exécuté. Le staging est standalone éphémère. Le backend rc.3 refuse toute écriture financière sur standalone avec 503 avant mutation.

Le propriétaire a autorisé un replica set staging à un membre, un volume 1 GB, l’authentification et la régénération synthétique si l’export reste inaccessible. Le volume et la configuration sont préparés, pas appliqués. Le bootstrap Mongo 8.0.32 et le compte readWrite limité à la base synthétique passent cinq contrôles Docker isolés, dont transaction majorité et persistance après redémarrage. Un membre ne fournit pas la haute disponibilité. Budget indicatif décrit dans [topologie Railway](phase3-railway-topology.md), sans migration de production. [Preuve bootstrap](../release-evidence/phase3/mongodb-staging-topology-ci.json).

## 5. Corrections financières — PASS dans le périmètre testé

Commandes, stock, groupes, transactions, crédits livreur, résolution des litiges et réservations de retrait sont désormais inscrits dans des transactions multi-documents. Les montants sont validés en centimes entiers, avec Decimal pour commissions et arrondis. Le journal de libération est équilibré. Les opérations concurrentes utilisent une révision ou une transition conditionnelle. FC est l’alias CDF ; une devise inconnue ou mélangée dans le portefeuille livreur bloque le crédit.

Les notifications et analyses de fraude après commit utilisent une outbox. Aucun appel de paiement externe n’est exécuté dans une transaction susceptible de rejouer son callback. Un retrait reste réservé ou en attente fournisseur ; une réponse technique d’émission ne le transforme pas en paiement terminé. Les résultats incertains restent à réconcilier et ne sont pas réémis automatiquement. [Carte financière](phase3-financial-map.md), [tests](phase3-functional-tests.md).

## 6. Interruption et reprise — PASS

Les tests injectent des interruptions à chaque frontière d’écriture et arrêtent brutalement un processus backend, puis vérifient l’absence d’écriture partielle et la reprise. Deux failpoints du serveur Mongo injectent réellement TransientTransactionError et UnknownTransactionCommitResult. La première tentative de commit ambigu avait révélé un défaut du contexte Motor ; la reprise explicite du commit le corrige et le test reste présent. [JUnit final](../release-evidence/phase3/backend-test-results.xml).

## 7. Idempotence — PASS

Les commandes et retraits exigent une clé de 8 à 128 caractères et une empreinte canonique du payload. Une réponse enregistrée dans la transaction est rejouable après perte réseau ou redémarrage. Une même clé avec un payload différent renvoie 409. Les callbacks validés produisent une seule capture et ne rétrogradent pas un paiement confirmé. Les interfaces conservent payload et clé pendant une réponse incertaine. [JUnit](../release-evidence/phase3/backend-test-results.xml), [carte financière](phase3-financial-map.md).

## 8. Paiements CinetPay — BLOCKED / NOT IMPLEMENTED

L’inventaire du backend historique a trouvé uniquement CINETPAY_NOTIFY_URL et CINETPAY_RETURN_URL, sans API_KEY, SITE_ID, SECRET_KEY ou TRANSFER_TOKEN confirmés. OAuth masque les valeurs. Aucun compte sandbox réel n’a été attesté ou transféré. Le contrat sandbox récent diffère de l’adaptateur v2 historique ; aucun simple changement d’URL n’est présenté comme une intégration certifiée.

PASS local : HMAC des champs officiels, altération de signature, référence/montant/devise divergents, replay, événement tardif et timeout. Le mode sandbox historique refuse les émissions vers le endpoint live. BLOCKED : succès/refus/attente/expiration opérateur, callback réel, permissions et réconciliation réelle. NOT IMPLEMENTED : remboursement fournisseur et premium certifié. Les remboursements partiels restent suspendus sur décision du propriétaire. [Matrice fournisseur](phase3-cinetpay-test-results.md), [intégration](phase3-cinetpay-integration.md).

## 9. Sécurité — PASS audits actuels

Audits Web et backend sans vulnérabilité connue signalée ; Bandit sans résultat, Ruff F821 vert et Gitleaks sur l’historique accessible sans fuite détectée. Aucun nosec ni baisse de seuil d’audit n’a été conservé. Les dépendances de build et développement ont également été vérifiées. Les contrôles restent datés, sans garantie de sécurité perpétuelle. [Rapport sécurité](phase3-security-report.md), [SAST](../release-evidence/phase3/backend-sast.json), [audit backend](../release-evidence/phase3/backend-audit.json), [audit Web](../release-evidence/phase3/web-audit.json), [scan expurgé](../release-evidence/phase3/secrets-redacted.json).

## 10. CI — PASS

[Run 38166788235](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38166788235) : dix jobs réussis, incluant Web, Android, émulateur, performance, backend, trois audits de sécurité, restauration et bootstrap Mongo. **88 tests backend, zéro échec, zéro erreur, zéro ignoré**, durée 101,24 s. Les checks de performance collectent les mesures ; leur conformité est évaluée explicitement dans le rapport, pas déduite de la seule couleur verte du job. [Manifeste CI](../release-evidence/phase3/ci-manifest.json).

## 11. Performance avant/après — PASS candidat local

Trois mesures mobiles de chaque build sur le même runner, baseline rc.2 exacte et candidat exact. Médianes :

| Mesure | rc.2 local | rc.3 local | Cible | Statut rc.3 |
|---|---:|---:|---:|---|
| Performance | 98 | 97 | ≥90 | PASS |
| LCP | 2,487 s | 2,419 s | ≤2,5 s | PASS |
| TBT | 16 ms | 0 ms | <200 ms | PASS |
| CLS | 0,0037 | 0,0037 | <0,1 | PASS |
| Accessibilité | 100 | 100 | ≥95 | PASS |
| Bonnes pratiques | 96 | 96 | ≥95 | PASS |
| SEO | 100 | 100 | ≥95 | PASS |

Une boucle antérieure rc.3 mesurait 3,19 s de LCP médian : FAIL conservé comme diagnostic. L’intégration fidèle des styles initiaux dans le HTML a supprimé les requêtes CSS et de déclaration des fontes bloquantes. Les résultats ne sont pas une amélioration artificielle de toutes les métriques : la baseline peut varier entre runs ; le score final rc.2 est même supérieur d’un point.

Les mesures HTTPS staging donnent de bons scores mais leur bundle ne correspond pas au candidat : il s’agit encore de la phase 2. Certification rc.3 HTTPS : BLOCKED. [Mesures et contexte](../release-evidence/phase3/performance-final.json), [rapport détaillé](phase3-performance-report.md).

## 12. PWA — PASS local / BLOCKED staging candidat

Le protocole navigateur fait réellement évoluer le worker rc.2/v8 vers rc.3/v9 et vérifie l’accueil visité hors ligne, les caches obsolètes, la conservation des caches étrangers, l’absence de fausse réussite API et le comportement des routes lazy non visitées. La reconnexion est testée. Aucun paiement hors ligne n’est certifié. [Résultat exact final](../release-evidence/phase3/pwa-upgrade-final.json), [rapport PWA/Android](phase3-pwa-android.md).

## 13. Android — PASS smoke / BLOCKED certification complète

Dix contrôles en émulateur passent : installation, rendu vert, accueil embarqué hors ligne, Retour depuis la racine, update du même APK, conservation des fichiers, désinstallation et réinstallation. Les contrôles n’incluent pas appareil physique, iOS, authentification complète, historique/modal Retour ni mise à jour rc.2→rc.3 avec certificat de distribution. L’APK reste debug staging. [Résultats](../release-evidence/phase3/android-emulator-results.json).

## 14. Artefacts — PASS intégrité

Chaque archive téléchargée est vérifiée contre le digest SHA-256 et la taille GitHub. Les SHA256SUMS internes sont vérifiés et sourceSha comparé à la source du run. Les livrables du candidat sont source, Web, PWA, APK debug, rapports et preuves ; leurs noms, tailles et SHA-256 sont dans artifact-manifest-final.json. Les clés, URI privées avec secrets, exports Mongo et archives de sauvegarde ne sont pas publiés. [Manifeste candidat](../release-evidence/phase3/artifact-manifest-final.json).

## 15. Pull Request — PASS brouillon

[PR 3](https://github.com/JonathanK-N/sellers-hub-2/pull/3), branche phase 3 vers phase 2, reste brouillon. Aucun merge. Le descriptif reprend corrections, validations et critères bloqués. Les PR et releases phase 1/2 restent inchangées.

## 16. Railway staging — BLOCKED application

Le propriétaire a confirmé Web staging et conversion Mongo avec régénération synthétique. Le contrôle accept-deploy a néanmoins refusé l’action avec « Cancelled — the user did not approve this action. No changes were made. ». Le patch est préparé et expurgé dans [railway-pending-final.json](../release-evidence/phase3/railway-pending-final.json). Ne pas appliquer l’ensemble avant configuration des variables scellées et de l’URI applicative. Le connecteur ne sait pas créer des variables scellées ; les deux mots de passe requis restent manquants. L’API phase 3 et les smoke financiers après déploiement ne sont pas déclarés réussis. Aucun passage par un autre outil pour contourner le refus. L’inventaire final confirme les mêmes déploiements de production sur main/6722492 et staging sur phase 2/cd08cc5 : [état final Railway](../release-evidence/phase3/railway-deployments-final.json).

## 17. Risques restants

BLOCKED : certification fournisseur sandbox, sauvegarde/restauration de production et RPO/RTO, conversion staging appliquée et configuration scellée, déploiement candidat et smoke, réconciliation historique des soldes et devises, validation Android physique/iOS et parcours authentifiés. NOT IMPLEMENTED : remboursement externe et premium certifié. Les nouveaux index uniques exigent un contrôle des doublons historiques avant production. Le replica set à un membre reste sans haute disponibilité. Tailwind 4 demande des navigateurs récents ; anciennes versions non certifiées. [Blocages et reprise](phase3-blockers.md), [rollback](phase3-rollback.md).

## 18. Décision — NO-GO production

Les corrections et preuves isolées sont reviewables, avec candidate gelé et release brouillon. Les critères critiques fournisseur, sauvegarde et validation déployée restent non satisfaits. La production ne sera proposée qu’après preuves réelles et approbation explicite. Aucune simulation n’est présentée comme certification opérateur ou reprise de production.
