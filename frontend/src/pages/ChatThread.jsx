import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { ArrowLeft, Send, RefreshCw } from "lucide-react";
import api, { formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// Author: Jonathan Kakesa (JonathanK-N).
export default function ChatThread() {
  const { conversationId } = useParams();
  const { state: meta = {} } = useLocation();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const scrollAfter = useRef(false);
  const prependAnchor = useRef(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(null);
  const [more, setMore] = useState(false);
  const scrollRef = useRef(null);
  const latest = useRef(null);
  const pending = useRef(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const [buyerId, sellerId] = (conversationId || "").split("__");
  const storageKey = "afri_chat_pending:" + user?.id + ":" + conversationId;
  const merge = rows => setMsgs(previous => [...new Map([...previous, ...rows].map(m => [m.id, m])).values()].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
  const acknowledgePending = rows => {
    if (pending.current && rows.some(m => m.client_message_id === pending.current.client_message_id && m.from_user_id === user?.id)) {
      pending.current = null; sessionStorage.removeItem(storageKey); setText("");
    }
  };
  const load = async (initial = false) => {
    if (busy.current || !user) return;
    busy.current = true;
    const current = generation.current;
    try {
      const { data } = await api.get("/messages/conversations/" + conversationId + "/history", { params: latest.current && !initial ? { after: latest.current, limit: 50 } : { limit: 50 } });
      if (current !== generation.current) return;
      scrollAfter.current = initial || !scrollRef.current || scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 100;
      merge(data.messages); acknowledgePending(data.messages);
      if (initial) { setOlder(data.next_before); setMore(data.has_more); }
      if (data.latest_cursor) latest.current = data.latest_cursor;
      setError("");
      if (data.latest_cursor && document.visibilityState === "visible") await api.post("/messages/conversations/" + conversationId + "/read", { through: data.latest_cursor });
    } catch (e) {
      if (current === generation.current) setError(formatApiError(e.response?.data?.detail) || "Connexion interrompue. Votre brouillon est conservé.");
    } finally { if (current === generation.current) { busy.current = false; setLoading(false); } }
  };
  useEffect(() => {
    generation.current += 1; busy.current = false; latest.current = null; prependAnchor.current = null; setSending(false); setMsgs([]); setLoading(true); setOlder(null); setMore(false);
    try { pending.current = JSON.parse(sessionStorage.getItem(storageKey)); } catch { pending.current = null; }
    setText(pending.current?.text || "");
    load(true);
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
    const reconnect = () => load();
    window.addEventListener("online", reconnect);
    window.addEventListener("afri-notifications-changed", reconnect);
    return () => { generation.current += 1; clearInterval(timer); window.removeEventListener("online", reconnect); window.removeEventListener("afri-notifications-changed", reconnect); };
  }, [conversationId, user?.id]);
  useEffect(() => {
    const anchor = prependAnchor.current;
    if (anchor && scrollRef.current) {
      const element = [...scrollRef.current.querySelectorAll("[data-message-id]")].find(row => row.dataset.messageId === anchor.id);
      if (element) scrollRef.current.scrollTop += element.getBoundingClientRect().top - anchor.top;
      prependAnchor.current = null;
    } else if (scrollAfter.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    scrollAfter.current = false;
  }, [msgs]);
  const loadOlder = async () => {
    const current = generation.current;
    try {
      const { data } = await api.get("/messages/conversations/" + conversationId + "/history", { params: { before: older, limit: 50 } });
      if (current !== generation.current) return;
      if (scrollRef.current) {
        const top = scrollRef.current.getBoundingClientRect().top;
        const element = [...scrollRef.current.querySelectorAll("[data-message-id]")].find(row => row.getBoundingClientRect().bottom >= top);
        if (element) prependAnchor.current = { id: element.dataset.messageId, top: element.getBoundingClientRect().top };
      }
      scrollAfter.current = false; merge(data.messages); setOlder(data.next_before); setMore(data.has_more); setError("");
    } catch (e) { if (current === generation.current) setError(formatApiError(e.response?.data?.detail)); }
  };
  const send = async () => {
    if (sending || !text.trim() || !user) return;
    setSending(true);
    const current = generation.current;
    try {
      if (!pending.current) {
        pending.current = { text: text.trim(), client_message_id: crypto.randomUUID() };
        if (user.role === "buyer") pending.current.seller_id = sellerId; else pending.current.buyer_id = buyerId;
        if (meta?.order_id) pending.current.order_id = meta.order_id;
        if (meta?.product_id) pending.current.product_id = meta.product_id;
        sessionStorage.setItem(storageKey, JSON.stringify(pending.current));
      }
      const { data } = await api.post("/messages", pending.current);
      if (current !== generation.current) return;
      scrollAfter.current = true; merge([data]); acknowledgePending([data]); setError("");
    } catch (e) { if (current === generation.current) setError(formatApiError(e.response?.data?.detail) || "Envoi incertain. Réessayez : le même message sera repris sans doublon."); }
    finally { if (current === generation.current) setSending(false); }
  };
  return <div className="mobile-shell !pb-0 flex flex-col h-dvh">
    <header className="bg-afri-secondary text-white px-4 py-3 flex items-center gap-3">
      <Link to="/messages" aria-label="Retour aux conversations" className="w-9 h-9 rounded-full flex items-center justify-center"><ArrowLeft size={20}/></Link>
      <div><h1 className="font-display font-bold">{meta?.other_name || "Conversation"}</h1><p className="text-xs text-afri-soft">{user?.role === "buyer" ? "Vendeur" : "Acheteur"}</p></div>
    </header>
    {error && <div role="alert" className="p-3 bg-amber-50 text-sm text-amber-900">{error}<button onClick={() => load()} className="ml-2 underline inline-flex gap-1"><RefreshCw size={14}/>Réessayer</button></div>}
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2" data-testid="chat-messages" aria-live="polite">
      {more && <button onClick={loadOlder} className="w-full text-afri-secondary text-sm py-2">Messages précédents</button>}
      {loading ? <p role="status">Chargement des messages…</p> : !msgs.length && <p className="text-center text-sm text-gray-500 mt-8">Démarrez la conversation.</p>}
      {msgs.map(m => <div key={m.id} data-message-id={m.id} className={"flex " + (m.from_user_id === user?.id ? "justify-end" : "justify-start")}><div className={"max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap " + (m.from_user_id === user?.id ? "bg-afri-primary-hover text-white" : "bg-white border border-gray-200 text-gray-900")}>{m.text}<time dateTime={m.created_at} className="block text-[10px] mt-1 opacity-80">{new Date(m.created_at).toLocaleString("fr-FR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</time></div></div>)}
    </div>
    <form onSubmit={e => { e.preventDefault(); send(); }} className="border-t bg-white px-3 py-3 flex items-center gap-2">
      <input aria-label="Votre message" data-testid="chat-input" value={text} maxLength={2000} readOnly={!!pending.current} onChange={e => setText(e.target.value)} placeholder="Votre message…" className="flex-1 min-w-0 border rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-afri-primary"/>
      <button type="submit" aria-label={pending.current ? "Réessayer l’envoi" : "Envoyer le message"} data-testid="chat-send-btn" disabled={sending || !text.trim()} className="w-11 h-11 shrink-0 rounded-full bg-afri-primary-hover hover:bg-afri-secondary text-white flex items-center justify-center disabled:opacity-50"><Send size={18}/></button>
    </form>
    <p className="px-3 pb-2 text-[11px] text-gray-500">Ne partagez jamais vos codes secrets. Un justificatif ne prouve pas la réception d’un paiement.</p>
  </div>;
}
