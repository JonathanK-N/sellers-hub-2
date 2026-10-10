import { Component } from "react";

export default class PageBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-afri-secondary">
        <h1 className="text-xl font-semibold">Cette page est momentanément indisponible</h1>
        <p>Vérifiez votre connexion, puis réessayez.</p>
        <button className="bg-afri-primary-hover text-white rounded-lg px-4 py-2" onClick={() => window.location.reload()}>Réessayer</button>
        <a href="/" className="underline">Revenir à l’accueil</a>
      </main>;
    }
    return this.props.children;
  }
}
