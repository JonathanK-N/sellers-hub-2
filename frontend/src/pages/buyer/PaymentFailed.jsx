import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";

export default function PaymentFailed() {
  return (
    <div className="mobile-shell pt-24 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#FCEBEB] text-[#791F1F] flex items-center justify-center mx-auto">
        <XCircle size={32} />
      </div>
      <h1 className="font-display font-black text-xl text-[#085041] mt-4">Paiement échoué</h1>
      <p className="text-gray-500 text-sm mt-2">
        Le paiement n'a pas pu être finalisé. Aucun montant n'a été débité. Vous pouvez réessayer.
      </p>

      <div className="mt-6 space-y-2">
        <Link
          to="/buyer/cart"
          className="block w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors"
        >
          Retour au panier
        </Link>
        <Link
          to="/buyer/orders"
          className="block w-full border border-gray-200 text-gray-700 rounded-lg py-3 font-semibold transition-colors"
        >
          Mes commandes
        </Link>
      </div>
    </div>
  );
}
