# AfriMarket phase 2 — état de reprise après livraison

Auteur : Jonathan Kakesa (JonathanK-N). Date : 11 octobre 2026.

Candidate immuable : 9176e82debf2b35f7262d64416fa9cb5e983726b, tag v1.0.1-green-rc.2. Build merge : 7f01a60aaf64df622fb3732a16195e25e7068650. Branche stabilization/afrimarket-phase-2, PR #2 en brouillon ; référence de phase 1 dd6d186 préservée.

CI 38146644352 : Web, Android, backend, sécurité backend, émulateur et mesures PASS ; 53 tests backend et 10 contrôles Android installés. Audit Web FAIL : 12 low / 88 moderate / 221 high / 0 critical. Médianes : local 98, LCP 2,488 s ; HTTPS 90, LCP 3,163 s, TBT 20 ms, accessibilité/bonnes pratiques/SEO 100, CLS 0,000062. LCP HTTPS : FAIL.

Parcours HTTP synthétiques, panier et recherche dans le navigateur, sessions et upgrade PWA v7→v8 : PASS. Android : lancement hors ligne, Retour depuis la racine, mise à jour du même APK et réinstallation : PASS. Physique, iOS, sessions WebView, Retour dans les modales et ancien→nouveau APK entre signatures distinctes restent BLOCKED.

Livraison : release 409717666 en brouillon, 12 assets, vérification des hashes API PASS. Sources, Web, Android, APK, preuves des cycles et manifeste complet sont conservés. La release de phase 1 409214759 garde ses 17 assets. APK : 8 159 834 octets, SHA256 3449a4d8db6b3beb51a269c99f2cc46f9b322dcbc4f147c9fcade52b480c7a9d. Rapport principal : docs/phase2-report.md. Archives privées : releases-20261011 dans le dossier voisin.

NO-GO : sauvegarde/restauration MongoDB BLOCKED (aucun accès configuré confirmé), paiement fournisseur sandbox BLOCKED, remboursement externe NOT IMPLEMENTED, durabilité financière multi-collections FAIL, chaîne de build Web FAIL, KYC/SMS/FCM/physique/iOS BLOCKED. Le remboursement partiel est suspendu explicitement jusqu’à définition des frais et commissions. Ne pas redemander cette confirmation ni activer un repli financier non atomique.

Aucun déploiement de production effectué pendant cette reprise. Inventaire actuel : main au SHA 6722492 pour Web/API ; différence avec le frontend initial 0e24300 consignée dans le rollback. Aucun paiement externe réel ni export de données personnelles. Les accès synthétiques restent hors dépôt.

Toute reprise doit partir du rapport et des blocages. Ne pas déclarer la candidate prête pour production, réécrire l’historique ou changer main/ui-ux/production sans approbation explicite. Contributions attribuées à JonathanK-N. Les documents ajoutés après le tag ne modifient pas le code compilé ; la CI exacte est référencée par son SHA.
