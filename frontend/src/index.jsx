import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App, { initialScreenReady } from "@/App";
import { Capacitor } from "@capacitor/core";

const root = ReactDOM.createRoot(document.getElementById("root"));
const render = () => root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// The public screen must be ready before its first mount, avoiding a fallback reveal.
// Private routes mount immediately so session verification is never delayed by code loading.
if (window.location.pathname === "/" && initialScreenReady) initialScreenReady.then(render);
else render();

// Register the PWA service worker (production only) so AfriMarket is installable
// and works partially offline.
if ("serviceWorker" in navigator && Capacitor.isNativePlatform()) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      const worker = registration.active || registration.waiting || registration.installing;
      if (worker && new URL(worker.scriptURL).pathname === "/service-worker.js") registration.unregister();
    }
  }).catch(() => {});
  if ("caches" in window) caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("afrimarket-")).map(key => caches.delete(key))
  )).catch(() => {});
}
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production" && !Capacitor.isNativePlatform()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
