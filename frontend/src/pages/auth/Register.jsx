import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import RegisterForm from "../../components/auth/RegisterForm";

/**
 * Page d'inscription autonome (/auth/register).
 * Conservee pour les liens directs, les e-mails et les redirections ;
 * dans l'application, l'inscription s'ouvre en modal superpose.
 */
export default function Register() {
  const [step, setStep] = useState(1);

  return (
    <div className="mobile-shell bg-white">
      <Link
        to="/"
        className="absolute left-4 top-4 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center z-10"
        data-testid="back-btn"
      >
        <ArrowLeft size={20} />
      </Link>

      <header className="px-6 pt-8 pb-5 flex flex-col items-center text-center border-b border-gray-100">
        <div className="w-12 h-12 rounded-xl bg-[#0b0b0d] text-[#f97316] flex items-center justify-center font-black text-xl mb-3">
          A
        </div>
        <h1 className="font-display font-black text-xl text-gray-900">Créer un compte</h1>
        <p className="text-sm text-gray-500 mt-1">
          Rejoignez la communauté AfriMarket · Étape {step} sur 2
        </p>
      </header>

      <div className="px-6 mt-6">
        <RegisterForm onStep={setStep} />
      </div>
    </div>
  );
}
