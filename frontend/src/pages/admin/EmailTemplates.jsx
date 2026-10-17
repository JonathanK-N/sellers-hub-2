import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiError } from "../../lib/api";

export default function EmailTemplates() {
  const [items, setItems] = useState([]);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api.get("/communications/admin/templates").then(({ data }) => setItems(data)).catch(e => setError(formatApiError(e.response?.data?.detail))); }, []);
  async function show(name) {
    setError(""); setHtml("");
    try { const { data } = await api.get(`/communications/admin/templates/${name}`, { responseType: "text" }); setHtml(data); }
    catch(e) { setError(formatApiError(e.response?.data?.detail)); }
  }
  return <main className="mx-auto max-w-5xl p-5"><h1 className="text-2xl font-bold">Modèles d’e-mails AfriMarket</h1>
    <p className="my-3">Prévisualisations synthétiques uniquement. Aucun message n’est envoyé depuis cet écran.</p>
    <label>Modèle<select className="m-3 max-w-full rounded border p-3" defaultValue="" onChange={e => show(e.target.value)}><option value="" disabled>Choisir un modèle</option>{items.map(item => <option key={item.id} value={item.id}>{item.subject}</option>)}</select></label>
    <p role="alert">{error}</p>{html && <iframe sandbox="" referrerPolicy="no-referrer" title="Aperçu synthétique de l’e-mail" srcDoc={html} className="h-[900px] w-full rounded border" />}
    <Link className="my-4 block underline" to="/admin/overview">Retour à l’administration</Link>
  </main>;
}
