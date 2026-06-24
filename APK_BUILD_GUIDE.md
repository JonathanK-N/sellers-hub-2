# 📱 Guide Build APK AfriMarket

## Prérequis à installer sur ton PC

1. **Java JDK 17** → https://adoptium.net (prendre Temurin 17 LTS)
2. **Android Studio** → https://developer.android.com/studio
3. **Node.js 20+** + **Yarn** → https://nodejs.org
4. **Git**

---

## Étape 1 — Cloner la branche apk

```bash
git clone https://github.com/JonathanK-N/sellers-hub-2.git
cd sellers-hub-2
git checkout apk
```

---

## Étape 2 — Installer les dépendances et builder

```bash
cd frontend
yarn install
yarn build
```

> ⚠️ Attendre la fin du build (2-3 minutes). Tu verras "Compiled successfully."

---

## Étape 3 — Synchroniser Capacitor

```bash
npx cap sync android
```

> Cette commande copie le build React dans le projet Android et installe les plugins natifs.

---

## Étape 4 — Firebase (Push Notifications)

1. Va sur https://console.firebase.google.com
2. Crée un projet "AfriMarket"
3. Clique "Ajouter une application Android"
4. Package name : `cd.cognito.afrimarket`
5. Télécharger `google-services.json`
6. **Copier** ce fichier dans : `frontend/android/app/google-services.json`

> Sans ce fichier, les push notifications ne fonctionnent pas.
> L'APK se build quand même sans, mais sans notifications.

---

## Étape 5 — Ouvrir dans Android Studio

```bash
npx cap open android
```

> OU ouvrir Android Studio manuellement → File → Open → sélectionner le dossier `frontend/android`

---

## Étape 6 — Dans Android Studio : Gradle Sync

À l'ouverture, Android Studio va demander de synchroniser Gradle.

1. Cliquer **"Sync Now"** dans la barre jaune en haut
2. Attendre la fin (5-10 minutes la première fois — télécharge les dépendances)
3. Vérifier que tout est vert en bas (Build output)

---

## Étape 7 — Créer le Keystore (une seule fois)

Le keystore = ta signature digitale. **Garde-le précieusement** — impossible de mettre à jour l'app sur le Play Store sans lui.

1. Dans Android Studio → **Build** → **Generate Signed Bundle / APK**
2. Choisir **APK** → Next
3. Cliquer **Create new...**
4. Remplir :
   - Key store path : choisir un dossier sûr, ex: `C:/AfriMarket/afrimarket.jks`
   - Password : un mot de passe fort (note-le précieusement)
   - Alias : `afrimarket`
   - Key password : (même mot de passe)
   - Validity : `25` ans
   - First and Last Name : `Jonathan Kakesa Nayaba`
   - Organization : `Cognito Inc`
   - Country Code : `CD`
5. Cliquer **OK**

---

## Étape 8 — Générer l'APK Release

Suite de l'étape 7 :

1. Le keystore est maintenant sélectionné → **Next**
2. Build Variant : choisir **release**
3. Signature Versions : cocher **V1 (Jar Signature)** et **V2 (Full APK Signature)**
4. Cliquer **Finish**
5. Attendre 3-5 minutes

L'APK sera généré dans :
```
frontend/android/app/release/app-release.apk
```

Une notification apparaîtra en bas : **"APK(s) generated successfully"**
Cliquer sur **"locate"** pour trouver le fichier.

---

## Étape 9 — Tester l'APK

### Sur ton téléphone Android :

1. **Activer les sources inconnues** :
   - Paramètres → Sécurité → Installer des apps inconnues → autoriser Chrome (ou explorateur fichiers)
2. Transférer l'APK sur le téléphone (USB, WhatsApp, Drive)
3. Ouvrir le fichier APK sur le téléphone → Installer
4. Ouvrir AfriMarket ✅

### Via Android Studio (émulateur ou téléphone branché USB) :

1. Brancher le téléphone en USB
2. Activer **Débogage USB** : Paramètres → Options développeur → Débogage USB
3. Dans Android Studio, cliquer le bouton ▶ (Run) en haut
4. Choisir ton téléphone → OK

---

## Étape 10 — Publier sur le Play Store

1. Créer un compte Google Play Developer → https://play.google.com/console (25$ unique)
2. Créer une nouvelle application "AfriMarket"
3. Remplir la fiche (description, captures d'écran, icônes)
4. Dans "Production" → "Créer une nouvelle version"
5. Uploader l'APK (ou générer un AAB depuis Android Studio — recommandé pour le Play Store)
6. Soumettre pour review (3-7 jours)

---

## ⚠️ Erreurs courantes et solutions

| Erreur | Solution |
|--------|----------|
| `JAVA_HOME not set` | Installer JDK 17, redémarrer le PC |
| `SDK not found` | Android Studio → SDK Manager → installer Android 14 (API 34) |
| `Gradle sync failed` | File → Invalidate Caches → Restart |
| `duplicate class` | `./gradlew clean` dans `frontend/android` |
| `google-services.json not found` | Normal sans Firebase, les push ne marcheront pas |
| `Manifest merger failed` | Vérifier AndroidManifest.xml — ne pas dupliquer les permissions |

---

## Architecture de l'APK AfriMarket

```
APK AfriMarket
├── WebView Capacitor
│   └── App React (afrimarket.up.railway.app)
│       ├── Acheteur
│       ├── Vendeur  
│       └── Livreur
├── Plugins natifs
│   ├── Camera (upload photos)
│   ├── Geolocation (produits près de moi)
│   ├── Push Notifications (commandes, messages)
│   ├── Network (détection hors-ligne)
│   └── Status Bar (couleur #085041)
└── Firebase (notifications push)
```

> L'app charge l'URL Railway au démarrage. Connexion internet requise.
> Hors ligne → écran "Hors ligne" du Service Worker.
