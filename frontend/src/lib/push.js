import api from "./api";

const FCM_VAPID_KEY = process.env.REACT_APP_FCM_VAPID_KEY;
const FIREBASE_CONFIG = process.env.REACT_APP_FIREBASE_CONFIG;
const DEVICE_TOKEN_KEY = "afri_device_token";

function isFirebaseConfigured() {
  return Boolean(FCM_VAPID_KEY && FIREBASE_CONFIG);
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "web";
}

async function registerToken(token) {
  try {
    await api.post("/notifications/device-token", { token, platform: detectPlatform() });
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

async function getFirebaseToken() {
  if (!isFirebaseConfigured()) {
    let t = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!t) t = `sim-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    return t;
  }
  try {
    // Indirect dynamic import so the bundler doesn't hard-require firebase at
    // build time. Firebase is an optional runtime dependency: install it and set
    // REACT_APP_FIREBASE_CONFIG to enable real push. In demo mode this branch is
    // never reached (isFirebaseConfigured() is false).
    const dynImport = new Function("m", "return import(m)");
    const { initializeApp } = await dynImport("firebase/app");
    const { getMessaging, getToken } = await dynImport("firebase/messaging");
    const app = initializeApp(JSON.parse(FIREBASE_CONFIG));
    const messaging = getMessaging(app);
    let swReg;
    if ("serviceWorker" in navigator) {
      swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    }
    return await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: swReg });
  } catch (e) {
    return null;
  }
}

export function notificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function enablePushNotifications() {
  if (typeof Notification === "undefined") {
    return { ok: false, reason: "unsupported" };
  }
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, reason: permission };
  }
  const token = await getFirebaseToken();
  if (!token) return { ok: false, reason: "token_failed" };
  const saved = await registerToken(token);
  return { ok: saved, simulated: !isFirebaseConfigured() };
}

export async function disablePushNotifications() {
  const token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (token) {
    try {
      await api.delete("/notifications/device-token", { data: { token } });
    } catch {
      // ignore
    }
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  }
  return { ok: true };
}

export function hasRegisteredToken() {
  return Boolean(localStorage.getItem(DEVICE_TOKEN_KEY));
}
