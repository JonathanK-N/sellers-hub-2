# Android build

Existing ui-ux Capacitor 6 configuration: appId cd.cognito.afrimarket; webDir build; remote server https://afrimarket.up.railway.app; cleartext false; mixed content false. Android minSdk 22, compile/target 34, Gradle plugin 8.2.1. Permissions include INTERNET. No production signing key created or used.

Important: current remote-server APK loads the production website, so packaging the corrected source alone cannot prove the green UI is served in Android. Test APKs must use isolated staging or bundled assets, with the override documented. Existing apk branch contains additional native configuration; no blind merge was performed.

No local Java/Android SDK/adb was found in PATH or standard inspected locations. Local compile/device testing remains BLOCKED until a toolchain is provisioned. GitHub Actions adds Java 17, Android tooling, capacitor sync and assembleDebug with artifact upload. CI result must be inspected before claiming an APK build passed. Physical-device authentication, navigation, network interruption, back button and external links remain BLOCKED.
