# Application mobile AfriMarket (Android via Capacitor)

L'app mobile est une coque native qui charge le site AfriMarket en ligne
(option A). Avantage : quand tu déploies une mise à jour sur Railway, l'app
mobile se met à jour automatiquement, **sans republier sur le Play Store**.

- **App ID** : `cd.cognito.afrimarket`
- **Nom** : AfriMarket
- **URL chargée** : définie dans `frontend/capacitor.config.json` → `server.url`
  (actuellement `https://afrimarket.up.railway.app`).
  ⚠️ Mets ici l'URL **publique de ton frontend Railway** si elle diffère, puis
  relance `npx cap sync android`.

## Prérequis (sur ta machine, pas sur le serveur)

1. **Node.js 20+** et **Yarn**
2. **Android Studio** (inclut le SDK Android + Gradle + JDK)
   → https://developer.android.com/studio
3. Un téléphone Android (mode développeur + débogage USB) ou un émulateur.

## Générer l'app (APK de test)

Depuis le dossier `frontend/` :

```bash
# 1. Installer les dépendances (si pas déjà fait)
yarn install

# 2. Builder le frontend web (nécessaire même en option A, pour le webDir)
REACT_APP_BACKEND_URL=https://sellers-hub-2-production.up.railway.app yarn build

# 3. Synchroniser avec le projet Android
npx cap sync android

# 4. Ouvrir dans Android Studio
npx cap open android
```

Dans Android Studio :
- Laisse-le télécharger/installer le Gradle nécessaire au premier lancement.
- **Run ▶** pour tester sur un appareil/émulateur.
- Pour un APK de test : menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
  L'APK est généré dans `android/app/build/outputs/apk/debug/`.

## Publier sur le Play Store (APK/AAB signé)

1. Crée un **compte développeur Google Play** (frais unique de 25 USD).
2. Dans Android Studio : **Build → Generate Signed Bundle / APK**.
   - Choisis **Android App Bundle (.aab)** (format requis par le Play Store).
   - Crée une **clé de signature** (keystore) et **conserve-la précieusement** :
     tu en auras besoin pour chaque mise à jour. Ne la perds jamais, ne la commite jamais.
3. Téléverse le `.aab` sur la Google Play Console, remplis la fiche (description,
   captures d'écran, politique de confidentialité), puis soumets pour revue.

## Mettre à jour l'app plus tard

- **Changement de contenu/fonctionnalités** : tu déploies sur Railway → l'app se
  met à jour toute seule (elle charge le site en ligne). Rien à republier.
- **Changement de l'icône, du nom, des permissions, ou de l'URL chargée** : il faut
  régénérer et republier l'AAB (incrémente `versionCode` dans
  `android/app/build.gradle`).

## Notes

- L'app exige une connexion Internet (elle charge le site distant).
- Pour une version qui embarque le code (fonctionne hors-ligne au démarrage),
  retire le bloc `server.url` de `capacitor.config.json` et refais un `cap sync`.

## iOS (nécessite un Mac)

La plateforme iOS est déjà ajoutée (dossier `frontend/ios/`). La compilation iOS
**exige obligatoirement un Mac** avec Xcode + un compte Apple Developer (99 USD/an).

Sur un Mac, depuis `frontend/` :

```bash
# 1. Installer CocoaPods (une seule fois)
sudo gem install cocoapods

# 2. Builder le web + synchroniser
REACT_APP_BACKEND_URL=https://sellers-hub-2-production.up.railway.app yarn build
npx cap sync ios

# 3. Ouvrir dans Xcode
npx cap open ios
```

Dans Xcode :
- Sélectionne ton équipe de développement (Signing & Capabilities).
- Choisis un simulateur ou un iPhone connecté, puis **Run ▶**.
- Pour publier : **Product → Archive**, puis distribue via l'App Store Connect.

- **App ID iOS** : `cd.cognito.afrimarket`
- **Nom** : AfriMarket
- L'icône et le splash iOS sont déjà aux couleurs AfriMarket.
