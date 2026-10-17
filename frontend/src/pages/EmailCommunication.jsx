import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function linkToken(mode) {
  const key = `afri-email-link-${mode}`;
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  try {
    if (token) sessionStorage.setItem(key, JSON.stringify({ token, until: Date.now() + 10 * 60000 }));
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (saved?.until > Date.now()) return saved.token;
    sessionStorage.removeItem(key);
  } catch { /* The current link still works when storage is unavailable. */ }
  return token || "";
}

export default function EmailCommunication({ mode }) {
  const { user, refresh } = useAuth();
  const [token] = useState(() => linkToken(mode));
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => { window.history.replaceState(null, "", window.location.pathname); }, []);
  const titles = { forgot: "Réinitialiser par e-mail", reset: "Choisir un nouveau mot de passe",
    verify: "Confirmer votre adresse e-mail", settings: "Vérifier votre adresse e-mail", invitation: "Accepter l’invitation de livraison" };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const endpoints = { forgot: "/password/request-reset", reset: "/password/reset",
        verify: "/email/verify", settings: "/email/request-verification", invitation: "/invitations/accept" };
      const payload = ["forgot", "settings"].includes(mode) ? { email } : mode === "reset" ? { token, password } : { token };
      const { data } = await api.post("/communications" + endpoints[mode], payload);
      setMessage(data.message || "Demande enregistrée.");
      if (["verify", "reset", "invitation"].includes(mode)) {
        sessionStorage.removeItem(`afri-email-link-${mode}`);
        setDone(true);
      }
      if (mode === "verify" && user) await refresh();
      if (data.next?.startsWith("/become-deliverer?shop=")) setNext(data.next);
      if (mode === "reset") {
        localStorage.removeItem("afri_token"); localStorage.removeItem("afri_user");
        window.dispatchEvent(new Event("afri-session-expired"));
      }
    } catch (error) { setMessage(formatApiError(error.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-emerald-50 px-4 py-12"><form onSubmit={submit} className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
    <h1 className="text-2xl font-bold text-emerald-950">{titles[mode]}</h1>
    {mode === "settings" && <p className="my-4">{user?.email_verified ? `Adresse vérifiée : ${user.email}. Votre adresse actuelle reste valide jusqu’à confirmation d’une nouvelle adresse.` : "Confirmez votre adresse pour sécuriser votre compte et recevoir vos communications."}</p>}
    {mode === "invitation" && <p className="my-4">Connectez-vous au compte acheteur dont l’adresse e-mail vérifiée correspond à l’invitation. L’acceptation ne remplace pas la candidature et ses contrôles.</p>}
    {["forgot", "settings"].includes(mode) && <label className="my-4 block">Adresse e-mail<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded border p-3" /></label>}
    {mode === "reset" && <label className="my-4 block">Nouveau mot de passe (12 caractères minimum)<input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded border p-3" /></label>}
    {!["forgot", "settings"].includes(mode) && !token ? <p role="alert" className="my-4">Lien absent ou expiré. Demandez un nouvel e-mail.</p> : <button disabled={busy || done} className="my-4 w-full rounded-lg bg-emerald-700 p-3 font-semibold text-white disabled:opacity-50">{done ? "Confirmation terminée" : busy ? "Veuillez patienter…" : mode === "settings" ? "Envoyer le lien de vérification" : "Confirmer"}</button>}
    <p role="status" aria-live="polite">{message}</p>
    {mode === "verify" && <Link className="my-4 block underline" to="/email/settings">Gérer mon adresse ou demander un nouveau lien</Link>}
    {next && <Link className="my-4 block underline" to={next}>Compléter ma candidature et mes documents</Link>}
    <Link className="mt-5 block underline" to="/auth/login">Se connecter</Link>
    {mode === "invitation" && <><Link className="mt-3 block underline" to="/auth/register">Créer un compte</Link><p className="mt-3 text-sm">Après connexion et vérification de l’adresse, rouvrez le lien reçu pour accepter l’invitation.</p></>}
    <Link className="mt-3 block underline" to="/">Revenir à AfriMarket</Link>
  </form></main>;
}
