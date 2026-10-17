import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { formatApiError } from "../lib/api";

export default function BecomeSeller() {
  const { user, setSession } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const buying = user.role === "seller";
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post(user.seller_enabled ? "/auth/switch-role" : "/auth/become-seller",
        user.seller_enabled ? { role: buying ? "buyer" : "seller" } : {});
      setSession(data.token, data.user);
      nav(buying ? "/buyer/home" : "/seller/setup", { replace: true });
    } catch (e) { setError(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return <main className="mobile-shell px-5 py-12"><h1 className="text-2xl font-bold">{buying ? "Mon espace acheteur" : "Vendre sur AfriMarket"}</h1>
    <p className="my-5">Vous conservez votre compte, vos commandes et vos messages. Chaque espace affiche les achats ou les ventes qui le concernent.</p>
    {!user.seller_enabled && <p className="my-5">Créez votre boutique après activation. La vérification de votre identité et les conditions de vente habituelles restent applicables.</p>}
    <button disabled={busy} onClick={submit} className="rounded-lg bg-emerald-700 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Veuillez patienter…" : buying ? "Ouvrir mon espace acheteur" : user.seller_enabled ? "Ouvrir mon espace vendeur" : "Activer mon espace vendeur"}</button>
    <p role="alert" className="my-4">{error}</p><Link to="/buyer/profile" className="underline">Retour au profil</Link>
  </main>;
}
