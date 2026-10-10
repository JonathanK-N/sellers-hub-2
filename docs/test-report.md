# Rapport de validation — AfriMarket

Auteur : Jonathan Kakesa (JonathanK-N). Date : 10 octobre 2026.

La palette verte originale a été restaurée en conservant la structure UI-UX. La production est restée inchangée. Une PR en brouillon et un staging isolé permettent la revue. Les validations ci-dessous décrivent uniquement les actions réellement exécutées.

| Domaine | Résultat | Preuve ou limite |
|---|---|---|
| Sauvegardes Git | PASS | Sept références distantes archivées, tags et bundle vérifié |
| Sauvegarde Mongo cohérente / restauration | BLOCKED | Volume inventorié, aucun dump restauré ni planning vérifié |
| Builds Web / backend / Android | PASS sur 890d8e7 | Actions 38087694857, trois jobs SUCCESS |
| Tests backend | PASS | Neuf tests santé et modèles ; build Railway et CI |
| Builds de référence A et B | PASS | Actions 38085613413 ; checksums dans reference-web-artifacts.json |
| Responsive 390 / 768 / 1440 | PASS | browser-validation.json et captures ; aucune erreur JS relevée |
| Modal authentification / fermeture Escape | PASS | browser-validation.json |
| Panier authentifié / route commande | PASS | pwa-cart-validation.json |
| Service worker réel / cache green-v7 | PASS | pwa-cart-validation.json |
| Cache ancien / API hors connexion | PASS, test isolé | service-worker-tests.log ; ne certifie pas un appareil installé |
| Session en coupure réseau | PASS | offline-session-after.json ; cache conservé sur erreur réseau |
| Santé staging | PASS | staging-smoke.json |
| Santé production | FAIL | Réponse degraded, get_db absent ; correction disponible uniquement sur staging |
| Administrateur / listes / KYC lecture | PASS | Sept vérifications staging-admin-validation.json |
| Acheteur / vendeur / livreur inscription, OTP, login | PASS | staging-integration.json, comptes synthétiques |
| Produit vendeur, boutique, commande retrait cash | PASS | staging-integration.json ; aucun paiement réel |
| Messages / notifications / historique / profil | PASS pour opérations consignées | Ne certifie pas tous les parcours métier |
| Quantité nulle | FAIL initial puis PASS après correction | Rejet HTTP 422 ; tests modèles |
| APK debug | Build PASS ; appareil BLOCKED | Application .staging, API staging, ressources Web embarquées |
| Paiements, remboursements, KYC upload, livraison complète | BLOCKED | Intégrations externes et parcours complets non certifiés |
| Installation PWA Android/iOS / mise à jour installée | BLOCKED | Aucun appareil physique disponible |
| Lighthouse | FAIL (performance) | 43 performance, 94 accessibilité, 100 bonnes pratiques, 92 SEO ; lighthouse.json |
| Contraste petits textes | OPEN | Blanc sur vert ~3,38:1 et ambre ~2,15:1 ; palette exacte conservée |

Les échecs initiaux d’installation locale, le premier build Android échoué et les anomalies constatées restent traçables. Les builds cloud ont résolu les limitations de compilation locale. Aucun résultat statique ou test simulé ne vaut certification métier complète.

PR : https://github.com/JonathanK-N/sellers-hub-2/pull/1
Staging : https://afrimarket-web-staging-staging.up.railway.app

La mise en production reste conditionnée à la sauvegarde Mongo vérifiée, aux validations des parcours sensibles et des appareils, puis à l’approbation du propriétaire.

Lighthouse final : voir lighthouse-status.json et rapport brut lighthouse.json ; optimisation nécessaire avant production.
