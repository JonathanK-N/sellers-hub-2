import { Link } from "react-router-dom";
import { ShieldCheck, MapPin, Smartphone, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#E1F5EE] to-white">
      <div className="mobile-shell !pb-0">
        <header className="px-5 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#1D9E75] flex items-center justify-center font-display font-black text-white text-xl">
              A
            </div>
            <div>
              <div className="font-display font-black text-lg leading-tight text-[#085041]">
                AfriMarket
              </div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                Marché de l'Afrique francophone
              </div>
            </div>
          </div>
        </header>

        <section className="px-5 mt-6">
          <div className="rounded-2xl overflow-hidden bg-[#085041] text-white p-6 relative">
            <img
              src="https://images.unsplash.com/photo-1625989744655-9bff7a23dac4?crop=entropy&cs=srgb&fm=jpg&w=800&q=70"
              alt="Marché africain"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="relative">
              <h1 className="font-display font-black text-3xl leading-tight tracking-tight">
                Le marché de l'Afrique francophone, près de chez vous.
              </h1>
              <p className="text-emerald-100 mt-3 text-sm leading-relaxed">
                Achetez et vendez en toute confiance avec Mobile Money. Paiement
                sécurisé, livraison locale, vendeurs vérifiés.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  to="/auth/register"
                  data-testid="cta-register"
                  className="bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 px-4 font-semibold transition-colors flex justify-center items-center gap-2"
                >
                  Créer mon compte
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/auth/login"
                  data-testid="cta-login"
                  className="bg-white/10 hover:bg-white/20 text-white rounded-lg py-3 px-4 font-semibold transition-colors flex justify-center items-center gap-2 border border-white/20"
                >
                  Se connecter
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 mt-8 grid grid-cols-1 gap-3">
          <Feature
            icon={MapPin}
            title="Recherche par proximité"
            desc="Filtre GPS de 1 km à 50 km autour de vous"
          />
          <Feature
            icon={ShieldCheck}
            title="Paiements sécurisés (Escrow)"
            desc="L'argent n'est libéré qu'à la livraison confirmée"
          />
          <Feature
            icon={Smartphone}
            title="Mobile Money local"
            desc="MTN MoMo, Airtel, Orange, Wave"
          />
        </section>

        <section className="px-5 mt-8 mb-10">
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { flag: "🇨🇩", name: "RD Congo" },
              { flag: "🇨🇲", name: "Cameroun" },
              { flag: "🇨🇮", name: "Côte d'Ivoire" },
              { flag: "🇸🇳", name: "Sénégal" },
              { flag: "🇧🇯", name: "Bénin" },
            ].map((c) => (
              <div key={c.name} className="rounded-lg bg-white border border-gray-100 p-2">
                <div className="text-xl">{c.flag}</div>
                <div className="text-[10px] text-gray-600 mt-1 leading-tight">{c.name}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="font-display font-bold text-gray-900 text-base">{title}</h3>
        <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
