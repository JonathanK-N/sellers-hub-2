import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Camera, Facebook, Globe, Phone, Plus, X, Save } from "lucide-react";
import api, { formatApiError } from "../../lib/api";
import BottomNav from "../../components/BottomNav";

const CATEGORIES = ["Général","Électronique","Vêtements","Alimentation","Maison","Énergie / Solaire","Agriculture","Beauté","Santé","Matériaux","Services","Autre"];

export default function EditProfile() {
  const nav = useNavigate();
  const logoRef = useRef();
  const bannerRef = useRef();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [specialty, setSpecialty] = useState("");

  const [form, setForm] = useState({
    shop_name: "", description: "", long_description: "",
    category: "Général", product_specialties: [],
    address: "", neighborhood: "", opening_hours: "08:00-18:00",
    latitude: 0, longitude: 0, shop_logo_url: null, shop_banner_url: null,
    social_links: { facebook: "", tiktok: "", whatsapp_business: "", instagram: "" },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setSocial = (k, v) => setForm(f => ({ ...f, social_links: { ...f.social_links, [k]: v } }));

  useEffect(() => {
    api.get("/seller/me").then(({ data }) => {
      if (!data) { nav("/seller/setup"); return; }
      setForm({
        shop_name: data.shop_name || "",
        description: data.description || "",
        long_description: data.long_description || "",
        category: data.category || "Général",
        product_specialties: data.product_specialties || [],
        address: data.address || "",
        neighborhood: data.neighborhood || "",
        opening_hours: data.opening_hours || "08:00-18:00",
        latitude: data.location?.coordinates?.[1] || 0,
        longitude: data.location?.coordinates?.[0] || 0,
        shop_logo_url: data.shop_logo_url || null,
        shop_banner_url: data.shop_banner_url || null,
        social_links: {
          facebook: data.social_links?.facebook || "",
          tiktok: data.social_links?.tiktok || "",
          whatsapp_business: data.social_links?.whatsapp_business || "",
          instagram: data.social_links?.instagram || "",
        },
      });
    }).catch(() => {});
  }, [nav]);

  const uploadFile = async (e, type) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(type);
    try {
      const fd = new FormData(); fd.append("file", file);
      const route = type === "logo" ? "/seller/upload-logo" : "/seller/upload-banner";
      const { data } = await api.post(route, fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (type === "logo") set("shop_logo_url", data.url);
      else set("shop_banner_url", data.url);
      toast.success(type === "logo" ? "Photo de profil mise à jour !" : "Bannière mise à jour !");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const addSpecialty = () => {
    if (specialty.trim() && !form.product_specialties.includes(specialty.trim())) {
      set("product_specialties", [...form.product_specialties, specialty.trim()]);
      setSpecialty("");
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      const social = {};
      Object.entries(form.social_links).forEach(([k, v]) => { if (v.trim()) social[k] = v.trim(); });
      await api.post("/seller/setup", { ...form, social_links: Object.keys(social).length ? social : null });
      toast.success("Profil mis à jour !");
      nav("/seller/dashboard");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div className="mobile-shell pb-24">
      <header className="sticky top-0 z-40 bg-[#085041] text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <Link to="/seller/dashboard" className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"><ArrowLeft size={20} /></Link>
        <h1 className="font-display font-black text-xl flex-1">Profil boutique</h1>
        <button onClick={save} disabled={loading} className="bg-[#EF9F27] text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
          <Save size={16} /> {loading ? "…" : "Enregistrer"}
        </button>
      </header>

      {/* BANNIÈRE + LOGO */}
      <div className="relative">
        <div onClick={() => bannerRef.current?.click()} className="w-full h-32 bg-gradient-to-r from-[#085041] to-[#1D9E75] flex items-center justify-center cursor-pointer overflow-hidden relative group">
          {form.shop_banner_url ? <img src={form.shop_banner_url} alt="bannière" className="w-full h-full object-cover" /> : null}
          <div className={`${form.shop_banner_url ? "absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100" : ""} flex items-center justify-center flex-col gap-1`}>
            <Camera size={20} className="text-white" />
            <span className="text-white text-xs font-medium">Photo de couverture</span>
          </div>
        </div>
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e, "banner")} />
        <div className="absolute -bottom-10 left-4">
          <button onClick={() => logoRef.current?.click()} className="relative w-20 h-20 rounded-full border-4 border-white bg-gray-200 overflow-hidden shadow-md group">
            {form.shop_logo_url ? <img src={form.shop_logo_url} alt="logo" className="w-full h-full object-cover" /> : <Camera size={22} className="absolute inset-0 m-auto text-gray-500" />}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Camera size={16} className="text-white" /></div>
          </button>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => uploadFile(e, "logo")} />
        </div>
      </div>

      <div className="px-4 mt-14 space-y-5">
        {/* IDENTITÉ */}
        <Section title="Identité">
          <Field label="Nom de la boutique *">
            <input value={form.shop_name} onChange={e => set("shop_name", e.target.value)} className={inp} />
          </Field>
          <Field label="Catégorie">
            <select value={form.category} onChange={e => set("category", e.target.value)} className={inp + " bg-white"}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Produits vendus">
            <div className="flex gap-2">
              <input value={specialty} onChange={e => setSpecialty(e.target.value)} onKeyDown={e => e.key === "Enter" && addSpecialty()} placeholder="Ajouter un tag" className={`${inp} flex-1`} />
              <button onClick={addSpecialty} className="w-10 h-10 rounded-lg bg-[#E1F5EE] text-[#1D9E75] flex items-center justify-center shrink-0"><Plus size={18} /></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.product_specialties.map(s => (
                <span key={s} className="flex items-center gap-1 bg-[#E1F5EE] text-[#085041] text-xs font-medium px-3 py-1.5 rounded-full">
                  {s}<button onClick={() => set("product_specialties", form.product_specialties.filter(x => x !== s))}><X size={12} /></button>
                </span>
              ))}
            </div>
          </Field>
        </Section>

        {/* DESCRIPTION */}
        <Section title="Description">
          <Field label="Accroche courte *">
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="Décrivez votre boutique en une phrase…" className={`${inp} resize-none`} />
            <p className="text-xs text-gray-400 mt-1">{form.description.length}/150 car.</p>
          </Field>
          <Field label="Présentation complète">
            <p className="text-xs text-gray-500 mb-1.5">Parlez de votre histoire, expertise, garanties. Plus vous êtes détaillé, plus les clients vous font confiance.</p>
            <textarea value={form.long_description} onChange={e => set("long_description", e.target.value)} rows={7} placeholder="Fondée en 2018, notre boutique s'est spécialisée dans… Nous garantissons… Nos clients peuvent compter sur…" className={`${inp} resize-none`} />
          </Field>
          <Field label="Horaires">
            <input value={form.opening_hours} onChange={e => set("opening_hours", e.target.value)} placeholder="08:00-18:00" className={inp} />
          </Field>
        </Section>

        {/* LOCALISATION */}
        <Section title="Localisation">
          <Field label="Quartier *">
            <input value={form.neighborhood} onChange={e => set("neighborhood", e.target.value)} placeholder="Gombe, Akwa, Plateau…" className={inp} />
          </Field>
          <Field label="Adresse">
            <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Av. du Marché, n°12" className={inp} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude GPS">
              <input type="number" step="any" value={form.latitude || ""} onChange={e => set("latitude", parseFloat(e.target.value)||0)} placeholder="-4.32" className={inp} />
            </Field>
            <Field label="Longitude GPS">
              <input type="number" step="any" value={form.longitude || ""} onChange={e => set("longitude", parseFloat(e.target.value)||0)} placeholder="15.31" className={inp} />
            </Field>
          </div>
        </Section>

        {/* RÉSEAUX SOCIAUX */}
        <Section title="Réseaux sociaux">
          <p className="text-xs text-gray-500 mb-3">Ces liens apparaissent sur votre page boutique publique. Tout est optionnel.</p>
          {[
            { key: "facebook", icon: <Facebook size={18} className="text-blue-600" />, label: "Page Facebook", placeholder: "https://facebook.com/..." },
            { key: "tiktok", icon: <span className="text-sm font-bold text-gray-800">TK</span>, label: "TikTok", placeholder: "https://tiktok.com/@..." },
            { key: "whatsapp_business", icon: <Phone size={18} className="text-green-600" />, label: "WhatsApp Business", placeholder: "+243..." },
            { key: "instagram", icon: <Globe size={18} className="text-pink-500" />, label: "Instagram", placeholder: "https://instagram.com/..." },
          ].map(({ key, icon, label, placeholder }) => (
            <div key={key} className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">{icon}</div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">{label}</label>
                <input value={form.social_links[key]} onChange={e => setSocial(key, e.target.value)} placeholder={placeholder} className={`${inp} mt-0.5`} />
              </div>
            </div>
          ))}
        </Section>
      </div>

      <BottomNav role="seller" />
    </div>
  );
}

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]";
function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-bold text-[#085041] mb-3 pb-2 border-b border-gray-100">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return <div><label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>{children}</div>;
}
