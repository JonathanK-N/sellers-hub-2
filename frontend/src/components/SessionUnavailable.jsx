import { useAuth } from "../context/AuthContext";

export default function SessionUnavailable() {
  const { refresh } = useAuth();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p role="alert" data-testid="session-unavailable" className="text-gray-700">
        La vérification de votre session est momentanément indisponible. Vérifiez votre connexion puis réessayez.
      </p>
      <button type="button" data-testid="session-retry" onClick={refresh} className="min-h-11 rounded-lg bg-afri-primary px-6 py-3 font-medium text-white">
        Réessayer
      </button>
    </main>
  );
}
