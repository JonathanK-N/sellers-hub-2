/* Firebase Cloud Messaging service worker.
 * Active uniquement quand une vraie configuration Firebase est fournie au build.
 * En mode démo (sandbox), ce worker s'enregistre sans config et reste inerte.
 */
/* eslint-disable */
try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

  // La configuration réelle est injectée via self.FIREBASE_CONFIG si disponible.
  if (self.FIREBASE_CONFIG) {
    firebase.initializeApp(self.FIREBASE_CONFIG);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(function (payload) {
      const n = payload.notification || {};
      self.registration.showNotification(n.title || "AfriMarket", {
        body: n.body || "",
        icon: "/logo192.png",
        data: payload.data || {},
      });
    });
  }
} catch (e) {
  // En l'absence de réseau ou de config, le worker reste inactif (mode démo).
}
