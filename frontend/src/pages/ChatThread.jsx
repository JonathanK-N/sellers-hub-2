import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function ChatThread() {
  const { conversationId } = useParams();
  const location = useLocation();
  const meta = location.state || {};
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Parse conversation id => buyer_id__seller_id
  const [buyerId, sellerId] = conversationId.split("__");
  const otherIsSeller = user?.role === "buyer";

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api.get(`/messages/conversations/${conversationId}`).then(({ data }) => {
        if (!cancelled) setMsgs(data);
        setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
      });
    load();
    const t = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [conversationId]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const payload = { text };
      if (user.role === "buyer") payload.seller_id = sellerId;
      else payload.buyer_id = buyerId;
      const { data } = await api.post("/messages", payload);
      setMsgs((m) => [...m, data]);
      setText("");
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
    } catch {} finally {
      setSending(false);
    }
  };

  return (
    <div className="mobile-shell !pb-0 flex flex-col h-screen">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/messages" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-display font-bold">{meta.other_name || "Conversation"}</h1>
          <p className="text-[10px] text-emerald-200 uppercase">{otherIsSeller ? "Vendeur" : "Acheteur"}</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2" data-testid="chat-messages">
        {msgs.length === 0 ? (
          <p className="text-center text-sm text-gray-500 mt-12">Démarrez la conversation 👋</p>
        ) : msgs.map((m) => {
          const mine = m.from_user_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-[#1D9E75] text-white rounded-br-sm" : "bg-white border border-gray-100 text-gray-900 rounded-bl-sm"}`}>
                {m.text}
                <div className={`text-[9px] mt-1 ${mine ? "text-emerald-100" : "text-gray-400"}`}>
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 bg-white px-3 py-3 flex items-center gap-2">
        <input
          data-testid="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Votre message…"
          className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]"
        />
        <button
          data-testid="chat-send-btn"
          disabled={sending || !text.trim()}
          onClick={send}
          className="w-10 h-10 rounded-full bg-[#1D9E75] hover:bg-[#168260] text-white flex items-center justify-center disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
