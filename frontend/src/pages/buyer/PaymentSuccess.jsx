import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import api from "../../lib/api";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [status, setStatus] = useState("checking");
  const [groupId, setGroupId] = useState(null);

  useEffect(() => {
    const id =
      params.get("transaction_id") ||
      params.get("cpm_trans_id") ||
      params.get("order_group_id") ||
      params.get("token");

    if (!id || id.startsWith("premium_")) {
      setStatus("done");
      return;
    }

    setGroupId(id);
    let attempts = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${id}`);
        if (data.payment_status === "paid" || data.payment_status === "captured_in_escrow") {
          setStatus("done");
          return;
        }
        if (data.payment_status === "failed") {
          nav("/payment/failed", { replace: true });
          return;
        }
      } catch {
        // ignore and retry
      }
      attempts += 1;
      if (attempts < 6) {
        setTimeout(poll, 1500);
      } else {
        setStatus("done");
      }
    };
    poll();
  }, [params, nav]);

  return (
    <div className="mobile-shell pt-24 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center mx-auto">
        {status === "checking" ? <Loader2 size={32} className="animate-spin" /> : <CheckCircle2 size={32} />}
      </div>
      <h1 className="font-display font-black text-xl text-[#085041] mt-4">
        {status === "checking" ? "Vérification du paiement…" : "Paiement reçu"}
      </h1>
      <p className="text-gray-500 text-sm mt-2">
        {status === "checking"
          ? "Merci de patienter quelques instants."
          : "Votre paiement a été enregistré. Vous pouvez suivre votre commande ci-dessous."}
      </p>

      {status === "done" && (
        <div className="mt-6 space-y-2">
          {groupId && (
            <Link
              to={`/buyer/order-group/${groupId}`}
              className="block w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors"
            >
              Voir ma commande
            </Link>
          )}
          <Link
            to="/buyer/orders"
            className="block w-full border border-gray-200 text-gray-700 rounded-lg py-3 font-semibold transition-colors"
          >
            Mes commandes
          </Link>
        </div>
      )}
    </div>
  );
}
