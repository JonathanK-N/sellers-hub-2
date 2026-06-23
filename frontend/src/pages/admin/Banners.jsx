import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Image, RefreshCw } from "lucide-react";
import api, { API_BASE } from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { toast } from "sonner";

const POSITIONS = [
  { value: "home_top", label: "Accueil — Haut (carousel)" },
  { value: "home_mid", label: "Accueil — Milieu (bannière)" },
  { value: "search_top", label: "Recherche — Haut" },
  { value: "product_bottom", label: "Fiche produit — Bas" },
];

const TARGET_ROLES = [
  { value: "all", label: "Tous les utilisateurs" },
  { value: "buyer", label: "Acheteurs seulement" },
  { value: "seller", label: "Vendeurs seulement" },
  { value: "deliverer", label: "Livreurs seulement" },
];

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", subtitle: "", link_url: "", position: "home_top", target_role: "all", image_url: "" });

  const load = () => {
    setLoading(true);
    api.get("/admin/banners").then(({ data }) => setBanners(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("afri_token");
      const res = await fetch(`${API_BASE}/seller/upload-photo`, {
        method: "POST", body: fd,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setForm((f) => ({ ...f, image_url: data.url }));
      toast.success("Image uploadée");
    } catch { toast.error("Erreur upload"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const create = async () => {
    if (!form.title || !form.image_url) { toast.error("Titre et image obligatoires"); return; }
    try {
      await api.post("/admin/banners", form);
      toast.success("Bannière créée");
      setCreating(false);
      setForm({ title: "", subtitle: "", link_url: "", position: "home_top", target_role: "all", image_url: "" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const toggleActive = async (b) => {
    try {
      await api.patch(`/admin/banners/${b.id}`, { is_active: !b.is_active });
      toast.success(b.is_active ? "Bannière masquée" : "Bannière activée");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const deleteBanner = async (id) => {
    if (!window.confirm("Supprimer cette bannière ?")) return;
    try {
      await api.delete(`/admin/banners/${id}`);
      toast.success("Bannière supprimée");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div className="pl-10 lg:pl-0">
          <h1 className="font-display font-black text-xl text-[#085041]">Affiches & Banners</h1>
          <p className="text-xs text-gray-500">Gérez le contenu affiché aux utilisateurs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw size={16} className="text-gray-500" /></button>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 text-sm font-semibold bg-[#1D9E75] text-white px-4 py-2 rounded-lg hover:bg-[#168260]">
            <Plus size={16} /> Nouvelle bannière
          </button>
        </div>
      </header>

      <main className="p-4 lg:p-8 max-w-7xl space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement…</div>
        ) : banners.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <Image size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Aucune bannière créée</p>
            <p className="text-xs text-gray-400 mt-1">Créez votre première affiche pour l'accueil</p>
            <button onClick={() => setCreating(true)}
              className="mt-4 bg-[#1D9E75] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#168260]">
              Créer une bannière
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((b) => (
              <div key={b.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex ${b.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                <div className="w-32 h-24 bg-gray-100 shrink-0 overflow-hidden">
                  {b.image_url ? <img src={b.image_url.startsWith("http") ? b.image_url : `${API_BASE.replace("/api","")}${b.image_url}`} alt="" className="w-full h-full object-cover" /> :
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><Image size={24} /></div>}
                </div>
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900">{b.title}</div>
                      {b.subtitle && <div className="text-xs text-gray-500 mt-0.5">{b.subtitle}</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleActive(b)} className={`p-1.5 rounded-lg hover:bg-gray-100 ${b.is_active ? "text-[#1D9E75]" : "text-gray-400"}`}>
                        {b.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => deleteBanner(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {POSITIONS.find((p) => p.value === b.position)?.label || b.position}
                    </span>
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {TARGET_ROLES.find((r) => r.value === b.target_role)?.label || b.target_role}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.is_active ? "bg-[#E1F5EE] text-[#1D9E75]" : "bg-gray-100 text-gray-500"}`}>
                      {b.is_active ? "Visible" : "Masquée"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal création */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-black text-lg text-[#085041]">Nouvelle bannière</h2>
              <button onClick={() => setCreating(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Upload image */}
              <div>
                <label className="text-sm font-medium text-gray-700">Image *</label>
                <label className="mt-1.5 block border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#1D9E75] transition-colors">
                  {form.image_url ? (
                    <img src={form.image_url.startsWith("http") ? form.image_url : `${API_BASE.replace("/api","")}${form.image_url}`}
                      alt="" className="max-h-32 mx-auto rounded-lg object-contain" />
                  ) : (
                    <div className="text-gray-400">
                      <Image size={32} className="mx-auto mb-2" />
                      <span className="text-sm">{uploading ? "Upload en cours…" : "Cliquez pour uploader"}</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploading} />
                </label>
              </div>

              <Field label="Titre *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Ex: Soldes d'été chez AfriMarket" />
              <Field label="Sous-titre" value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} placeholder="Ex: Jusqu'à -30% sur l'électronique" />
              <Field label="Lien (optionnel)" value={form.link_url} onChange={(v) => setForm({ ...form, link_url: v })} placeholder="Ex: /buyer/search?q=promo" />

              <div>
                <label className="text-sm font-medium text-gray-700">Position</label>
                <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-[#1D9E75]">
                  {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Visible pour</label>
                <select value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })}
                  className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-[#1D9E75]">
                  {TARGET_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <button onClick={create}
                className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold text-sm transition-colors">
                Créer la bannière
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
    </div>
  );
}
