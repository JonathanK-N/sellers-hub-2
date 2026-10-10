# Android build

Existing ui-ux Capacitor 6 configuration: appId cd.cognito.afrimarket; webDir build; remote server https://afrimarket.up.railway.app; cleartext false; mixed content false. Android minSdk 22, compile/target 34, Gradle plugin 8.2.1. Permissions include INTERNET. No production signing key created or used.

Important: current remote-server APK loads the production website, so packaging the corrected source alone cannot prove the green UI is served in Android. Test APKs must use isolated staging or bundled assets, with the override documented. Existing apk branch contains additional native configuration; no blind merge was performed.

No local Java/Android SDK/adb was found in PATH or standard inspected locations. Local compile/device testing remains BLOCKED until a toolchain is provisioned. GitHub Actions adds Java 17, Android tooling, capacitor sync and assembleDebug with artifact upload. CI result must be inspected before claiming an APK build passed. Physical-device authentication, navigation, network interruption, back button and external links remain BLOCKED.

Executed cloud build: GitHub Actions run 38085613306 produced afrimarket-android-debug-e250fc316f357c8dfa4f7b77b3babe113d33115a. Source head e98a73d7aa0543bfcf03f28ed6d8c3df0323502b; PR merge e250fc316f357c8dfa4f7b77b3babe113d33115a. Debug application ID cd.cognito.afrimarket.staging, versionCode 2, versionName 1.0.1-green.1-debug. The workflow removes Capacitor server.url, embeds the Web build and uses the isolated staging API. Build PASS; physical tests BLOCKED. Subsequent session fix b71f84e requires its matching final artifacts.

Final candidate: source 890d8e76341c3bb08f3d7452e7ecf87e08d222dd / merge 837024d51699099f7805776f8f734cbe301a227c / run 38087694857 SUCCESS. ZIP contains APK and release-metadata.json with Node 20.20.2, Java Temurin 17.0.20.1, SDK 34 and build timestamp. Green-build-artifacts.json gives final checksums.
