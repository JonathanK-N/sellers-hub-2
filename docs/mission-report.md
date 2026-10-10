# AfriMarket — rapport de mission

Auteur : Jonathan Kakesa (JonathanK-N). 10 octobre 2026.

1. **État initial.** La branche UI-UX remplaçait le vert historique par orange/noir. Le frontend réellement servi correspondait à 0e24300a3fa0, et non au tip 83be26533e8b ; deux déploiements ultérieurs avaient échoué. Backend production : 6722492d85e0.
2. **Branches.** main, ui-ux, apk, develop, dev et backup examinées ; détails et SHA complets dans branch-audit.md. Aucun merge aveugle, notamment dev sans ancêtre commun retrouvé.
3. **Sauvegardes.** Sept branches archive datées et tags annotés distants, bundle Git local vérifié, configurations Railway sans secrets. La sauvegarde cohérente Mongo et son exercice de restauration restent BLOCKED.
4. **Couleurs.** Comparaison par provenance avec main, revue des correspondances et restauration supplémentaire de 109 lignes neutralisées. Tokens #1d9e75, #168260, #085041, #e1f5ee et #ef9f27. Couleurs fonctionnelles et fonds neutres préservés. Voir ui-theme-restoration.md et les trois fichiers theme-*.json / neutralized-brand-restoration.json.
5. **UI-UX conservée.** Structure des pages, typographie, animations, responsive, modales authentification/panier et navigation conservés sur base ui-ux. Les captures et tests ciblés prouvent certains parcours ; aucune prétention de couverture exhaustive.
6. **Anomalies.** get_db absent au healthcheck, quantités de commande nulles acceptées, screenshot manifest absent, purge caches trop large, session effacée lors d’erreur réseau, contraste historique insuffisant et favori sans action. Tableau ci-dessous.
7. **Corrections.** Import santé, validation Pydantic quantité positive/prix-stock non négatifs, cache green-v7 limité à AfriMarket, manifest corrigé, session conservée sauf 401/403, APK debug isolé avec ressources embarquées.
8. **Tests.** CI 38087694857 SUCCESS sur b71f84ece757f00208df300e99bd9b418ae5fb40 ; neuf tests backend ; opérations synthétiques et sept contrôles admin. test-report.md distingue les sous-tests PASS des parcours complets BLOCKED.
9. **PWA.** Manifest/icônes et worker validés, worker réel actif, panier et recharge shell verte hors connexion PASS ; session sur coupure API PASS. Installation physique, iOS et upgrade d’une PWA déjà installée BLOCKED. Lighthouse sans score disponible à cette étape.
10. **APK.** Build debug PASS en CI. ID cd.cognito.afrimarket.staging, versionCode 2, versionName 1.0.1-green.1-debug, API staging et Web embarqué. Pas de clé de signature production. Tests physiques BLOCKED.
11. **Packages.** Sources A, B-tip, B-déployée et C ; builds Web A/B et Web/PWA C, APK C. Empreintes et chemins dans release-evidence/artifact-manifest.json, reference-web-artifacts.json et green-build-artifacts.json. Stockage local privé frère Afrimarket-private-backups/releases-20261010. Les builds A/B utilisent l’API staging et ne reproduisent pas la configuration de production.
12. **Commits et PR.** d2a5e7a, d49d06f, 23fecab, e98a73d, b71f84e ; auteur/committer Jonathan Kakesa. PR brouillon https://github.com/JonathanK-N/sellers-hub-2/pull/1. Source testée b71f84e ; merge CI 138be800420b368a8313323e73d4b48f70e043f0.
13. **Staging.** https://afrimarket-web-staging-staging.up.railway.app ; API isolée et Mongo synthétique. Web 26d4c19a-c892-4aa0-85f9-c8fd97165619 et API 507be901-d5f2-43fc-899e-06911e7b22d8 SUCCESS. Voir deployment.md.
14. **Risques.** Mongo staging éphémère ; restauration Mongo production non exercée ; parcours paiements/remboursements/KYC upload/livraisons/litiges/fraude non certifiés ; petit texte blanc sur vert/ambre en dessous de 4,5:1 ; comportement sur appareil non testé.
15. **Avant production.** Vérifier et restaurer un backup Mongo isolé, compléter les parcours critiques sandbox et les essais physiques, résoudre le contraste avec respect de la palette, revoir la PR et la procédure rollback, puis obtenir l’approbation explicite de JonathanK-N. La production n’a pas été modifiée.

| Anomalie | Priorité | Cause | Correction | État |
|---|---|---|---|---|
| Identité orange/noir | P1 | Remplacement couleurs UI-UX | Restauration par provenance et tokens | PASS ciblé |
| Santé dégradée | P1 | Import get_db manquant | Import et deux tests | PASS staging ; FAIL production existante |
| Quantité nulle acceptée | P1 | Modèle sans contrainte | Field(gt=0) et régression | PASS 422 après FAIL initial |
| Session perdue hors réseau | P1 | Catch indiscriminé | Effacement seulement 401/403 | PASS coupure API |
| Purge autres caches | P2 | Suppression globale | Préfixe afrimarket | PASS test worker |
| Screenshot absent | P2 | Référence manifest invalide | Entrée supprimée | PASS statique |
| APK test charge production | P1 | server.url production | Bundle et API staging, suffixe debug | Build PASS ; appareil BLOCKED |
| Contraste petit texte | P2 | Palette historique + blanc | Focus amélioré ; décision design restante | OPEN |
| Favori sans action | P2 | Handler preventDefault uniquement | Fonction non inventée | NOT IMPLEMENTED |

Preuves CI : https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38087694857 ; références : https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38085613413. La mission est partielle tant que les blocages ci-dessus subsistent.

Release brouillon (propriétaire authentifié) : https://github.com/JonathanK-N/sellers-hub-2/releases/tag/untagged-9fd79eb60abda7d39e73 ; 12 assets, identifiants dans draft-release-assets.json. Matrice complète par fonctionnalité : feature-matrix.md.

Contrôle final packaging : le Web CI initial b71f84e ciblait localhost ; il est conservé comme diagnostic, sans usage de déploiement. Candidate actuelle 890d8e76341c3bb08f3d7452e7ecf87e08d222dd, merge CI 837024d51699099f7805776f8f734cbe301a227c, run 38087694857 : Web/backend/Android PASS. Métadonnées embarquées et API staging vérifiées dans les ZIP. Rejet HTTP 401 et coupure API observée PASS. Commits supplémentaires : 67bc904 documentation, 890d8e7 packaging.
