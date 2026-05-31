import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

/**
 * Floating action button for unread messages.
 * Positions inside bottom nav as a 6th badge for buyers; on seller side replaces the Profile slot? No — we keep simple: shows in a corner.
 * Instead we just embed it inside TopBar via a small icon.
 */
export default function MessagesIndicator() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get("/messages/unread-count");
        if (!cancelled) setCount(data.count);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

  return (
    <Link
      to="/messages"
      data-testid="messages-indicator"
      className="relative w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
      aria-label="Messages"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#EF9F27] text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
