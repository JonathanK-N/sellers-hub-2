import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store } from "lucide-react";
import api, { formatApiError } from "../../lib/api";

const CATEGORIES = ["Général", "Électronique", "Vêtements", "Alimentation", "Maison", "Solaire", "Agriculture"];

export default function SellerSetup() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    shop_name: "",
    description: "",
    category: "Général",
    address: "",
    neighborhood: "",
    opening_hours: "08:00-18:00",
    latitude: 0,
    longitude: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/seller/me").then(({ data }) => {
      if (data) nav("/seller/dashboard");
    });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setForm((f) => ({ ...f, latitude: p.coords.latitude, longitude: p.coords.longitude })),
        () => {}
      );
    }
  }, [nav]);

  const submit = async () => {
    if (!form.shop_name) {
      toast.error("Indiquez le nom de la boutique");
      return;
    }
    setLoading(true);
    try {
      await api.post("/seller/setup", form);
      toast.success("Boutique créée !");
      nav("/seller/dashboard");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell bg-white">
      <header className="px-5 pt-6 pb-2">
        <div className="w-14 h-14 rounded-xl bg-[#1D9E75] text-white flex items-center justify-center">
          <Store size={26} />
        </div>
        <h1 className="font-display font-black text-2xl text-[#085041] mt-3">
          Créez votre boutique
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Quelques infos pour démarrer. Vous pourrez les modifier plus tard.
        </p>
      </header>

      <div className="px-5 mt-4 space-y-4">
        <Input label="Nom de la boutique *" value={form.shop_name} onChange={(v) => setForm({ ...form, shop_name: v })} testid="shop-name-input" placeholder="Ex: Chez Mariam" />
        <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} testid="shop-description-input" placeholder="Décrivez votre boutique…" />
        <div>
          <label className="text-sm font-medium text-gray-700">Catégorie principale</label>
          <select
            data-testid="shop-category-select"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] outline-none"
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <Input label="Quartier" value={form.neighborhood} onChange={(v) => setForm({ ...form, neighborhood: v })} testid="shop-neighborhood-input" placeholder="Ex: Gombe, Bonapriso" />
        <Input label="Adresse / repère" value={form.address} onChange={(v) => setForm({ ...form, address: v })} testid="shop-address-input" placeholder="Près de l'église…" />
        <Input label="Horaires d'ouverture" value={form.opening_hours} onChange={(v) => setForm({ ...form, opening_hours: v })} testid="shop-hours-input" placeholder="08:00-18:00" />

        <button
          data-testid="setup-submit-btn"
          disabled={loading}
          onClick={submit}
          className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold disabled:opacity-50 transition-colors"
        >
          {loading ? "Création…" : "Créer ma boutique"}
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, testid }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
      />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, testid }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none resize-none"
      />
    </div>
  );
}
