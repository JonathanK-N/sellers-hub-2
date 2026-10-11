# Phase 2 — Android

Auteur : Jonathan Kakesa (JonathanK-N). APK de test exclusivement.

Version `1.0.1-green-rc.2-debug`, versionCode 3, applicationId `cd.cognito.afrimarket.staging`. Java 17, SDK 34, Capacitor 6.2.2. API cible : `https://afrimarket-api-staging-staging.up.railway.app`. Source finale taguée : `9176e82debf2b35f7262d64416fa9cb5e983726b`, tag `v1.0.1-green-rc.2`.

Le serveur distant de production est retiré de la configuration de l’APK avant le build ; Web, fonts et image d’accueil sont embarqués.

La mise à jour de tar vers une version corrigée avait cassé `cap sync` : le CLI utilisait un export default supprimé. Le postinstall transforme uniquement l’appel attendu du CLI 6.2.2 en export nommé ; une source/version inattendue provoque un échec explicite. Les builds Android corrigés passent ensuite.

L’émulateur ne trouvait initialement pas l’AVD. Le job fixe ANDROID_AVD_HOME, vérifie `-list-avds` et borne l’attente ADB. Sur aa587e5, huit contrôles installés passent : installation, rendu WebView, vert sombre visible, mise à jour du même APK, conservation des fichiers, désinstallation, réinstallation et suppression des anciens fichiers.

L’extension du test a reproduit un écran vide lors d’un lancement après coupure Wi-Fi/data. La correction sépare le worker navigateur du runtime natif, nettoie ses anciens caches et embarque les ressources. Sur le cycle AVIF, le lancement hors ligne et les huit contrôles de base passent. Le cycle2c a échoué lors de l’attente initiale fixe de8s ; la version taguée utilise une attente bornée sur le rendu réel et conserve les screenshots même en échec. Résultat final : PASS pour les10 contrôles installés, incluant redémarrage hors ligne et bouton Retour depuis la racine. [CI exacte](https://github.com/JonathanK-N/sellers-hub-2/actions/runs/38146644352), `release-evidence/phase2/android-9176e82/android-emulator-evidence/results.json`. Les preuves d’échec sont conservées avec XML/logcat ; elles ne sont pas supprimées du bilan.

Limites : `adb install -r` avec le même APK valide la conservation des fichiers, **pas** une mise à jour signée phase 1→phase 2. Les builds debug de runners distincts peuvent porter des certificats différents ; aucune compatibilité de signature inter-build n’est certifiée. Ne pas désinstaller un appareil contenant des données utiles pour contourner ce point sans sauvegarde adéquate.

Téléphone physique, iOS, sessions authentifiées dans le WebView, caméra/QR et Retour dans les modales/historique : BLOCKED dans ce rapport. Aucune signature de production, aucun keystore de production et aucune publication Play Store n’ont été utilisés.

Installation sur un appareil de test isolé : vérifier le SHA-256, installer l’APK debug (`adb install`), lancer l’application et vérifier qu’elle utilise l’API staging. Désinstaller uniquement l’application `.staging` pour une installation propre si nécessaire ; ce geste efface ses données locales. Le package de production reste distinct.

## Artefact final

`AfriMarket-1.0.1-green-rc.2-staging-debug-9176e82.apk`, 8159834octets, SHA256 `3449a4d8db6b3beb51a269c99f2cc46f9b322dcbc4f147c9fcade52b480c7a9d`. ZIP Actions : SHA256 `b1c35f2ffd374cf9d742704abdfefe611d80d6fd245499cb388f220a0d714b0b`. Le certificat est debug, aucune publication de production.
