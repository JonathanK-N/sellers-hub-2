import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "../lib/api";

export default function EmailCommunication({ mode }) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [next, setNext] = useState("");
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
    {mode === "invitation" && <p className="my-4">Connectez-vous au compte acheteur dont l’adresse e-mail vérifiée correspond à l’invitation. L’acceptation ne remplace pas la candidature et ses contrôles.</p>}
    {["forgot", "settings"].includes(mode) && <label className="my-4 block">Adresse e-mail<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded border p-3" /></label>}
    {mode === "reset" && <label className="my-4 block">Nouveau mot de passe (12 caractères minimum)<input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded border p-3" /></label>}
    {!["forgot", "settings"].includes(mode) && !token ? <p role="alert" className="my-4">Lien absent. Demandez un nouvel e-mail.</p> : <button disabled={busy} className="my-4 w-full rounded-lg bg-emerald-700 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Veuillez patienter…" : "Confirmer"}</button>}
    <p role="status" aria-live="polite">{message}</p>
    {next && <Link className="my-4 block underline" to={next}>Compléter ma candidature et mes documents</Link>}
    <Link className="mt-5 block underline" to="/auth/login">Se connecter</Link>
    {mode === "invitation" && <><Link className="mt-3 block underline" to="/auth/register">Créer un compte</Link><p className="mt-3 text-sm">Après connexion et vérification de l’adresse, rouvrez le lien reçu pour accepter l’invitation.</p></>}
    <Link className="mt-3 block underline" to="/">Revenir à AfriMarket</Link>
  </form></main>;
}
