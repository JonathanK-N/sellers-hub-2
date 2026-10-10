import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import LoginForm from "../../components/auth/LoginForm";

/**
 * Page de connexion autonome (/auth/login).
 * Conservee pour les liens directs, les e-mails et les redirections ;
 * dans l'application, la connexion s'ouvre en modal superpose.
 */
export default function Login() {
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
        <div className="w-12 h-12 rounded-xl bg-afri-secondary text-afri-primary flex items-center justify-center font-black text-xl mb-3">
          A
        </div>
        <h1 className="font-display font-black text-xl text-gray-900">Connexion</h1>
        <p className="text-sm text-gray-500 mt-1">Bienvenue sur AfriMarket</p>
      </header>

      <div className="px-6 mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
