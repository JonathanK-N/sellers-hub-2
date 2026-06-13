import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Store, ChevronRight, ChevronLeft, MapPin, Clock, Camera, Facebook, Globe, Phone, Plus, X } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import { photoUrl } from "../../lib/format";

const CATEGORIES = ["Général","Électronique","Vêtements","Alimentation","Maison","Énergie / Solaire","Agriculture","Beauté","Santé","Matériaux","Services","Autre"];
const STEPS = ["Identité","Description","Localisation","Réseaux"];

export default function SellerSetup() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef();

  const [form, setForm] = useState({
    shop_name: "", description: "", long_description: "",
    category: "Général", product_specialties: [],
    address: "", neighborhood: "", opening_hours: "08:00-18:00",
    latitude: 0, longitude: 0, shop_logo_url: null, shop_banner_url: null,
    social_links: { facebook: "", tiktok: "", whatsapp_business: "", instagram: "" },
  });
  const [specialty, setSpecialty] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setSocial = (k, v) => setForm(f => ({ ...f, social_links: { ...f.social_links, [k]: v } }));

  useEffect(() => {
    api.get("/seller/me").then(({ data }) => {
      if (data) nav("/seller/dashboard");
    }).catch(() => {});
  }, [nav]);

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/seller/upload-logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      set("shop_logo_url", data.url);
      toast.success("Photo de profil uploadée !");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const addSpecialty = () => {
    if (specialty.trim() && !form.product_specialties.includes(specialty.trim())) {
      set("product_specialties", [...form.product_specialties, specialty.trim()]);
      setSpecialty("");
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      const social = {};
      Object.entries(form.social_links).forEach(([k, v]) => { if (v.trim()) social[k] = v.trim(); });
      await api.post("/seller/setup", { ...form, social_links: Object.keys(social).length ? social : null });
      toast.success("Boutique créée !");
      nav("/seller/dashboard");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const canNext = [
    form.shop_name.trim().length >= 2,
    form.description.trim().length >= 10,
    form.neighborhood.trim().length >= 2,
    true,
  ];

  return (
    <div className="mobile-shell bg-white">
      <div className="bg-[#085041] px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Store size={20} className="text-white" /></div>
          <div><p className="text-white font-display font-black text-lg">Créer ma boutique</p><p className="text-white/70 text-xs">Étape {step+1} sur {STEPS.length}</p></div>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= step ? "bg-[#EF9F27]" : "bg-white/20"}`} />)}
        </div>
        <div className="flex justify-between mt-1.5">{STEPS.map((s, i) => <span key={i} className={`text-xs ${i === step ? "text-[#EF9F27] font-semibold" : "text-white/50"}`}>{s}</span>)}</div>
      </div>

      <div className="px-5 pt-5 pb-28">

        {/* ÉTAPE 1 — IDENTITÉ */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Commençons par l'identité de votre boutique.</p>
            {/* Logo */}
            <div className="flex flex-col items-center gap-2 py-3">
              <button onClick={() => logoRef.current?.click()} className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-[#E1F5EE] bg-gray-100 flex items-center justify-center group">
                {form.shop_logo_url ? <img src={photoUrl(form.shop_logo_url)} alt="logo" className="w-full h-full object-cover" /> : <Camera size={28} className="text-gray-400" />}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Camera size={20} className="text-white" /></div>
              </button>
              <p className="text-xs text-gray-400">{uploading ? "Upload en cours…" : "Photo de profil (optionnel)"}</p>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
            </div>
            <div><label className="text-sm font-medium text-gray-700">Nom de la boutique *</label>
              <input data-testid="setup-shop-name" value={form.shop_name} onChange={e => set("shop_name", e.target.value)} placeholder="ex: ÉlectroKin, Boutique Wax..." className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
            </div>
            <div><label className="text-sm font-medium text-gray-700">Catégorie principale</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-3 text-sm outline-none bg-white focus:ring-2 focus:ring-[#1D9E75]">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Produits vendus (tags)</label>
              <div className="mt-1.5 flex gap-2">
                <input value={specialty} onChange={e => setSpecialty(e.target.value)} onKeyDown={e => e.key === "Enter" && addSpecialty()} placeholder="ex: Téléphones, Pagnes..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
                <button onClick={addSpecialty} className="w-10 h-10 rounded-lg bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center"><Plus size={18} /></button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.product_specialties.map(s => (
                  <span key={s} className="flex items-center gap-1 bg-[#E1F5EE] text-[#085041] text-xs font-medium px-3 py-1.5 rounded-full">
                    {s}<button onClick={() => set("product_specialties", form.product_specialties.filter(x => x !== s))}><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 — DESCRIPTION */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Décrivez votre boutique pour rassurer vos futurs clients.</p>
            <div><label className="text-sm font-medium text-gray-700">Description courte * <span className="text-gray-400 font-normal">(accroche)</span></label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="ex: Spécialiste en téléphones reconditionnés à Kinshasa, livraison disponible." className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-[#1D9E75]" />
              <p className="text-xs text-gray-400 mt-1">{form.description.length}/150 caractères</p>
            </div>
            <div><label className="text-sm font-medium text-gray-700">Présentation complète <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <p className="text-xs text-gray-500 mb-1.5">Parlez de votre histoire, de vos valeurs, de votre expertise. Les acheteurs aiment connaître le vendeur.</p>
              <textarea value={form.long_description} onChange={e => set("long_description", e.target.value)} rows={6} placeholder="Nous sommes une boutique familiale fondée en 2018 à Gombe. Notre mission est de vous proposer des produits électroniques de qualité à des prix accessibles. Toutes nos marchandises sont garanties 3 mois et vérifiées avant expédition…" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-[#1D9E75]" />
            </div>
            <div><label className="text-sm font-medium text-gray-700">Horaires d'ouverture</label>
              <div className="relative mt-1.5"><Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.opening_hours} onChange={e => set("opening_hours", e.target.value)} placeholder="08:00-18:00" className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — LOCALISATION */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Indiquez où se trouve votre boutique pour être trouvé par les clients proches.</p>
            <div><label className="text-sm font-medium text-gray-700">Quartier *</label>
              <div className="relative mt-1.5"><MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input data-testid="setup-neighborhood" value={form.neighborhood} onChange={e => set("neighborhood", e.target.value)} placeholder="ex: Gombe, Lingwala, Akwa…" className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              </div>
            </div>
            <div><label className="text-sm font-medium text-gray-700">Adresse complète</label>
              <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="ex: Av. du Marché, n°12" className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-700">Latitude (GPS)</label>
                <input type="number" step="any" value={form.latitude || ""} onChange={e => set("latitude", parseFloat(e.target.value)||0)} placeholder="-4.32" className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              </div>
              <div><label className="text-xs font-medium text-gray-700">Longitude (GPS)</label>
                <input type="number" step="any" value={form.longitude || ""} onChange={e => set("longitude", parseFloat(e.target.value)||0)} placeholder="15.31" className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
              </div>
            </div>
            <div className="bg-[#E1F5EE] rounded-lg p-3">
              <p className="text-xs text-[#085041]"><strong>Astuce GPS :</strong> Ouvre Google Maps, appuie longuement sur ta boutique, et copie les coordonnées affichées en bas de l'écran.</p>
            </div>
          </div>
        )}

        {/* ÉTAPE 4 — RÉSEAUX SOCIAUX */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Connectez vos réseaux sociaux pour que les clients puissent vous retrouver. Tout est optionnel.</p>
            <div className="space-y-3">
              {[
                { key: "facebook", icon: <Facebook size={18} className="text-blue-600" />, label: "Page Facebook", placeholder: "https://facebook.com/maboutique" },
                { key: "tiktok", icon: <span className="text-lg font-bold text-gray-800">TK</span>, label: "Compte TikTok", placeholder: "https://tiktok.com/@maboutique" },
                { key: "whatsapp_business", icon: <Phone size={18} className="text-green-600" />, label: "WhatsApp Business", placeholder: "+243812345678" },
                { key: "instagram", icon: <Globe size={18} className="text-pink-500" />, label: "Instagram", placeholder: "https://instagram.com/maboutique" },
              ].map(({ key, icon, label, placeholder }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">{icon}</div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600">{label}</label>
                    <input value={form.social_links[key]} onChange={e => setSocial(key, e.target.value)} placeholder={placeholder} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75] mt-0.5" />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#E1F5EE] rounded-lg p-3">
              <p className="text-xs text-[#085041]">Ces liens apparaîtront sur votre page boutique publique et permettront aux clients de vous contacter directement.</p>
            </div>
          </div>
        )}
      </div>

      {/* BARRE DE NAVIGATION */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-3 pb-5 flex gap-3 z-50">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-3 font-semibold flex items-center justify-center gap-1.5 text-sm">
            <ChevronLeft size={18} /> Précédent
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button disabled={!canNext[step]} onClick={() => setStep(s => s + 1)} className="flex-1 bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
            Suivant <ChevronRight size={18} />
          </button>
        ) : (
          <button disabled={loading} onClick={submit} className="flex-1 bg-[#085041] hover:bg-[#0a6b55] text-white rounded-lg py-3 font-semibold text-sm disabled:opacity-50">
            {loading ? "Création en cours…" : "Créer ma boutique"}
          </button>
        )}
      </div>
    </div>
  );
}
