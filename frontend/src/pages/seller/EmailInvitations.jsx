import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { Link } from "react-router-dom";

export default function EmailInvitations() {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() { const { data } = await api.get("/communications/seller/invitations"); setRows(data); }
  useEffect(() => { load().catch(e => setError(formatApiError(e.response?.data?.detail))); }, []);
  async function action(run) {
    setBusy(true); setError("");
    try { await run(); await load(); } catch(e) { setError(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-2xl p-5"><h1 className="text-2xl font-bold">Invitations de livreurs</h1>
    <p className="my-3">La personne invitée doit vérifier son e-mail puis compléter la candidature. Son activation nécessite votre approbation.</p>
    <form onSubmit={e => { e.preventDefault(); action(() => api.post("/communications/seller/invitations", { name, email })); }} className="grid gap-3">
      <label>Nom<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className="block w-full rounded border p-3" /></label>
      <label>E-mail<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="block w-full rounded border p-3" /></label>
      <button disabled={busy} className="rounded bg-emerald-700 p-3 text-white">Envoyer une invitation</button>
    </form><p role="alert">{error}</p>
    <ul>{rows.map(row => <li key={row.id} className="my-4 rounded border p-4"><strong>{row.name}</strong><p>{row.email} — {row.status}</p>{row.status !== "accepted" && <div className="flex gap-4"><button disabled={busy} onClick={() => action(() => api.post(`/communications/seller/invitations/${row.id}/resend`))}>Renvoyer</button><button disabled={busy} onClick={() => action(() => api.post(`/communications/seller/invitations/${row.id}/cancel`))}>Annuler</button></div>}</li>)}</ul>
    <Link className="underline" to="/seller/deliverer-applications">Examiner les candidatures</Link>
  </main>;
}
