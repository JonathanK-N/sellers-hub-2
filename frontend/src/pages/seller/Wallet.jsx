import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Wallet as WalletIcon, ArrowDownToLine, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import TopBar from "../../components/TopBar";
import BottomNav from "../../components/BottomNav";
import { formatPrice, timeAgo } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";

export default function SellerWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(null);
  const [txs, setTxs] = useState([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState("");
  const [number, setNumber] = useState("");
  const [operator, setOperator] = useState("MTN MoMo");
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [b, t] = await Promise.all([
      api.get("/seller/wallet"),
      api.get("/seller/wallet/transactions"),
    ]);
    setBalance(b.data);
    setTxs(t.data);
  };

  useEffect(() => {
    load();
    api.get("/countries").then(({ data }) => {
      const c = data.find((x) => x.code === user?.country_code);
      if (c) {
        setOperators(c.mobile_money_operators);
        setOperator(c.mobile_money_operators[0]);
      }
    });
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [user?.country_code]);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post("/seller/wallet/withdraw", {
        amount: Number(amount),
        mobile_money_number: number,
        operator,
      });
      toast.success("Retrait initié — Effectué dans 2 minutes");
      setShowWithdraw(false);
      setAmount("");
      setNumber("");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  if (!balance) return <div className="mobile-shell pt-24 text-center text-gray-500">Chargement…</div>;

  return (
    <div className="mobile-shell">
      <TopBar title="Portefeuille" showCart={false} />

      <div className="px-4 mt-4 space-y-3">
        <section className="rounded-2xl bg-gradient-to-br from-[#085041] to-[#1D9E75] text-white p-5 shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-100 text-xs uppercase tracking-wider font-bold">
              <WalletIcon size={14} /> Solde disponible
            </div>
          </div>
          <div className="font-display font-black text-4xl mt-2" data-testid="wallet-available">
            {formatPrice(balance.available, balance.currency)}
          </div>
          <button
            data-testid="open-withdraw-btn"
            onClick={() => setShowWithdraw(true)}
            disabled={balance.available <= 0}
            className="mt-4 bg-white text-[#085041] rounded-lg py-2.5 px-4 font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 w-full"
          >
            <ArrowDownToLine size={16} /> Retirer
          </button>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat icon={TrendingUp} label="Total ventes" value={formatPrice(balance.gross_sales, balance.currency)} />
          <MiniStat icon={CheckCircle2} label="Commissions" value={formatPrice(balance.commission_paid, balance.currency)} negative />
        </div>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Historique</h3>
          {txs.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">Aucune transaction pour l'instant.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {txs.map((t) => (
                <div key={t.id} className="py-3 flex items-center gap-3" data-testid={`tx-${t.id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${t.type === "sale" ? "bg-[#E1F5EE] text-[#1D9E75]" : "bg-amber-50 text-[#EF9F27]"}`}>
                    {t.type === "sale" ? <TrendingUp size={16} /> : <ArrowDownToLine size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">
                      {t.type === "sale" ? "Vente" : "Retrait Mobile Money"}
                    </div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                      {t.type === "withdrawal" && (t.status === "in_progress" ? <><Clock size={10} /> En traitement</> : <><CheckCircle2 size={10} /> Effectué</>)}
                      <span>· {timeAgo(t.created_at)}</span>
                    </div>
                  </div>
                  <div className={`font-display font-bold text-sm ${t.amount < 0 ? "text-[#E24B4A]" : "text-[#085041]"}`}>
                    {t.amount > 0 ? "+" : ""}{formatPrice(t.amount, t.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showWithdraw && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowWithdraw(false)}>
          <div className="bg-white w-full max-w-md rounded-t-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-[#085041]">Retirer vers Mobile Money</h3>
            <div>
              <label className="text-xs font-medium text-gray-700">Montant ({balance.currency})</label>
              <input
                data-testid="withdraw-amount-input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max ${balance.available.toFixed(0)}`}
                className="w-full mt-1 border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Numéro Mobile Money</label>
              <input
                data-testid="withdraw-number-input"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex: +243812345678"
                className="w-full mt-1 border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Opérateur</label>
              <select
                data-testid="withdraw-operator-select"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]"
              >
                {operators.map((op) => <option key={op}>{op}</option>)}
              </select>
            </div>
            <button
              data-testid="confirm-withdraw-btn"
              disabled={loading}
              onClick={submit}
              className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold disabled:opacity-50"
            >
              {loading ? "Traitement…" : "Confirmer le retrait"}
            </button>
            <button onClick={() => setShowWithdraw(false)} className="w-full text-center text-sm text-gray-500 py-2">Annuler</button>
          </div>
        </div>
      )}

      <BottomNav role="seller" />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, negative }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-gray-500">
        <Icon size={12} /> {label}
      </div>
      <div className={`font-display font-bold text-base mt-1 ${negative ? "text-[#E24B4A]" : "text-[#085041]"}`}>{value}</div>
    </div>
  );
}
