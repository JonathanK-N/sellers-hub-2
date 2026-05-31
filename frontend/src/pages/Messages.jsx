import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MessageSquare } from "lucide-react";
import api from "../lib/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../lib/format";

export default function ConversationsList() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api.get("/messages/conversations").then(({ data }) => {
        if (!cancelled) setItems(data);
      }).finally(() => setLoading(false));
    load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <div className="mobile-shell">
      <TopBar title="Messages" showCart={false} />

      <div className="px-4 mt-4">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center mx-auto">
              <MessageSquare size={28} />
            </div>
            <p className="text-sm text-gray-500 mt-3">Aucune conversation pour l'instant.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <button
                key={c.conversation_id}
                data-testid={`conversation-${c.conversation_id}`}
                onClick={() => nav(`/messages/${c.conversation_id}`, { state: { other_name: c.other_name, buyer_id: c.buyer_id, seller_id: c.seller_id } })}
                className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 hover:border-[#1D9E75] transition-colors"
              >
                <div className="w-11 h-11 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-display font-black">
                  {c.other_name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 truncate">{c.other_name}</span>
                    <span className="text-[10px] text-gray-500">{timeAgo(c.last_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{c.last_text}</p>
                </div>
                {c.unread_count > 0 && (
                  <span className="ml-2 bg-[#EF9F27] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5">
                    {c.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav role={user?.role === "seller" ? "seller" : "buyer"} />
    </div>
  );
}
