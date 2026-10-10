import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Image, RefreshCw, AlertCircle, Sparkles, ToggleLeft, ToggleRight, Pencil, Check } from "lucide-react";
import api, { API_BASE } from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { toast } from "sonner";

const POSITIONS = [
  { value: "home_top",       label: "Accueil — Haut (carousel)" },
  { value: "home_mid",       label: "Accueil — Milieu (bannière)" },
  { value: "search_top",     label: "Recherche — Haut" },
  { value: "product_bottom", label: "Fiche produit — Bas" },
];

const TARGET_ROLES = [
  { value: "all",       label: "Tous les utilisateurs" },
  { value: "buyer",     label: "Acheteurs seulement" },
  { value: "seller",    label: "Vendeurs seulement" },
  { value: "deliverer", label: "Livreurs seulement" },
];

function imgSrc(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE.replace("/api", "")}${url}`;
}

const DEFAULT_PROMO = { visible: true, title: "Livraison gratuite dès 50 000 FC", subtitle: "Sur tous les produits dans votre quartier" };

export default function AdminBanners() {
  const [banners, setBanners]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewSrc, setPreviewSrc]   = useState("");
  const [form, setForm] = useState({ title: "", subtitle: "", link_url: "", position: "home_top", target_role: "all", image_url: "" });

  // État bloc promo fixe
  const [promo, setPromo]           = useState(DEFAULT_PROMO);
  const [promoLoading, setPromoLoading] = useState(true);
  const [promoSaving, setPromoSaving]   = useState(false);
  const [promoEditing, setPromoEditing] = useState(false);
  const [promoDraft, setPromoDraft]     = useState(DEFAULT_PROMO);

  const load = () => {
    setLoading(true);
    api.get("/admin/banners").then(({ data }) => setBanners(data)).catch(() => toast.error("Erreur chargement")).finally(() => setLoading(false));
  };

  const loadPromo = () => {
    setPromoLoading(true);
    api.get("/admin/config/promo-banner").then(({ data }) => { setPromo(data); setPromoDraft(data); }).catch(() => {}).finally(() => setPromoLoading(false));
  };

  useEffect(() => { load(); loadPromo(); }, []);

  const savePromo = async () => {
    setPromoSaving(true);
    try {
      await api.patch("/admin/config/promo-banner", promoDraft);
      setPromo(promoDraft);
      setPromoEditing(false);
      toast.success("Bloc promo mis à jour");
    } catch { toast.error("Erreur de sauvegarde"); }
    finally { setPromoSaving(false); }
  };

  const togglePromoVisible = async () => {
    const updated = { ...promo, visible: !promo.visible };
    try {
      await api.patch("/admin/config/promo-banner", updated);
      setPromo(updated);
      setPromoDraft(updated);
      toast.success(updated.visible ? "Bloc promo affiché" : "Bloc promo masqué");
    } catch { toast.error("Erreur"); }
  };

  const resetForm = () => {
    setForm({ title: "", subtitle: "", link_url: "", position: "home_top", target_role: "all", image_url: "" });
    setPreviewSrc("");
    setUploadError("");
  };

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setPreviewSrc(localPreview);
    setUploadError("");
    setUploading(true);
    try {
      const token = localStorage.getItem("afri_token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/admin/upload`, { method: "POST", body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `HTTP ${res.status}`); }
      const data = await res.json();
      if (!data.url) throw new Error("URL manquante");
      setForm((f) => ({ ...f, image_url: data.url }));
      toast.success("Image uploadée");
    } catch (err) {
      setUploadError(`Upload échoué : ${err.message}`);
      setPreviewSrc("");
      setForm((f) => ({ ...f, image_url: "" }));
      toast.error(`Upload échoué : ${err.message}`);
    } finally { setUploading(false); e.target.value = ""; }
  };

  const create = async () => {
    if (!form.title.trim()) { toast.error("Titre obligatoire"); return; }
    if (!form.image_url)    { toast.error("Image obligatoire"); return; }
    try {
      await api.post("/admin/banners", form);
      toast.success("Bannière créée !");
      setCreating(false);
      resetForm();
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const toggleActive = async (b) => {
    try {
      await api.patch(`/admin/banners/${b.id}`, { is_active: !b.is_active });
      toast.success(b.is_active ? "Bannière masquée" : "Bannière activée");
      load();
    } catch { toast.error("Erreur"); }
  };

  const deleteBanner = async (id) => {
    if (!window.confirm("Supprimer cette bannière ?")) return;
    try { await api.delete(`/admin/banners/${id}`); toast.success("Supprimée"); load(); }
    catch { toast.error("Erreur"); }
  };

  const formImgSrc = previewSrc || imgSrc(form.image_url);

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />

      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div className="pl-10 lg:pl-0">
          <h1 className="font-display font-black text-xl text-gray-900">Affiches & Banners</h1>
          <p className="text-xs text-gray-500">Gérez le contenu affiché aux utilisateurs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw size={16} className={`text-gray-500 ${loading ? "animate-spin" : ""}`} /></button>
          <button onClick={() => { resetForm(); setCreating(true); }} className="flex items-center gap-1.5 text-sm font-semibold bg-afri-primary text-white px-4 py-2 rounded-lg hover:bg-afri-primary-hover">
            <Plus size={16} /> Nouvelle bannière
          </button>
        </div>
      </header>

      <main className="p-4 lg:p-8 max-w-7xl space-y-6">

        {/* ── Section bloc promo fixe ─────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg var(--afri-success-bg) text-afri-primary flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Bloc promo fixe</h2>
                <p className="text-xs text-gray-500">Bandeau vert affiché sous les catégories (si aucune bannière home_mid)</p>
              </div>
            </div>
            <button
              onClick={togglePromoVisible}
              disabled={promoLoading}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                promo.visible ? "bg-afri-soft text-gray-900 hover:bg-[#c8ede1]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {promo.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              {promo.visible ? "Visible" : "Masqué"}
            </button>
          </div>

          <div className="px-5 py-4">
            {/* Preview du bloc promo */}
            <div className={`rounded-xl bg-gradient-to-r from-afri-secondary to-afri-primary text-white p-4 flex items-center gap-3 mb-4 ${!promo.visible ? "opacity-40" : ""}`}>
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0"><Sparkles size={18} /></div>
              <div>
                <p className="font-display font-bold text-sm">{promo.title || "—"}</p>
                <p className="text-xs text-emerald-100 mt-0.5">{promo.subtitle || "—"}</p>
              </div>
            </div>

            {promoEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Titre</label>
                  <input value={promoDraft.title} onChange={(e) => setPromoDraft({ ...promoDraft, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-afri-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Sous-titre</label>
                  <input value={promoDraft.subtitle} onChange={(e) => setPromoDraft({ ...promoDraft, subtitle: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-afri-primary" />
                </div>
                <div className="flex gap-2">
                  <button onClick={savePromo} disabled={promoSaving}
                    className="flex items-center gap-1.5 bg-afri-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-afri-primary-hover">
                    <Check size={15} /> {promoSaving ? "Sauvegarde…" : "Enregistrer"}
                  </button>
                  <button onClick={() => { setPromoEditing(false); setPromoDraft(promo); }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setPromoEditing(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 border border-afri-primary px-3 py-1.5 rounded-lg hover:bg-afri-soft transition-colors">
                <Pencil size={14} /> Modifier le texte
              </button>
            )}
          </div>
        </section>

        {/* ── Bannières dynamiques ────────────────────────────────────────── */}
        <section>
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Bannières dynamiques ({banners.length})</h2>

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Chargement…</div>
          ) : banners.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
              <Image size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium text-sm">Aucune bannière créée</p>
              <p className="text-xs text-gray-400 mt-1">Créez votre première affiche</p>
              <button onClick={() => { resetForm(); setCreating(true); }} className="mt-4 bg-afri-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-afri-primary-hover">
                Créer une bannière
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {banners.map((b) => (
                <div key={b.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex ${b.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                  <div className="w-28 h-20 bg-gray-100 shrink-0 overflow-hidden">
                    {b.image_url ? <img src={imgSrc(b.image_url)} alt="" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Image size={20} /></div>}
                  </div>
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{b.title}</div>
                        {b.subtitle && <div className="text-xs text-gray-500 mt-0.5">{b.subtitle}</div>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleActive(b)} className={`p-1.5 rounded-lg hover:bg-gray-100 ${b.is_active ? "text-afri-primary" : "text-gray-400"}`}>
                          {b.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button onClick={() => deleteBanner(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {POSITIONS.find((p) => p.value === b.position)?.label || b.position}
                      </span>
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {TARGET_ROLES.find((r) => r.value === b.target_role)?.label || b.target_role}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.is_active ? "var(--afri-success-bg) text-afri-primary" : "bg-gray-100 text-gray-500"}`}>
                        {b.is_active ? "Visible" : "Masquée"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Modal création bannière ─────────────────────────────────────────── */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-black text-lg text-gray-900">Nouvelle bannière</h2>
              <button onClick={() => { setCreating(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Image <span className="text-red-500">*</span></label>
                <label className={`block border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors ${
                  uploadError ? "border-red-300 bg-red-50" : formImgSrc ? "border-afri-primary" : "border-gray-300 hover:border-afri-primary"
                }`}>
                  {formImgSrc ? (
                    <div className="relative">
                      <img src={formImgSrc} alt="Preview" className="w-full max-h-48 object-cover" />
                      {uploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><div className="text-white text-sm font-semibold animate-pulse">Upload en cours…</div></div>}
                      {!uploading && form.image_url && <div className="absolute top-2 right-2 bg-afri-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Uploadée</div>}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400">
                      <Image size={36} className="mx-auto mb-2" />
                      <span className="text-sm font-medium">{uploading ? "Upload en cours…" : "Cliquez pour sélectionner"}</span>
                      <p className="text-xs mt-1">JPG, PNG, WebP</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploading} />
                </label>
                {uploadError && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle size={15} className="shrink-0" />{uploadError}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {uploading ? "⏳ Upload en cours…" : form.image_url ? "✅ Image prête" : "Sélectionnez une image avant de soumettre"}
                </p>
              </div>

              <Field label="Titre *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Ex: Soldes d'été chez AfriMarket" />
              <Field label="Sous-titre" value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} placeholder="Ex: Jusqu'à -30% sur l'électronique" />
              <Field label="Lien (optionnel)" value={form.link_url} onChange={(v) => setForm({ ...form, link_url: v })} placeholder="Ex: /buyer/search?q=promo" />

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Position</label>
                <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-afri-primary">
                  {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Visible pour</label>
                <select value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-afri-primary">
                  {TARGET_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <button onClick={create} disabled={uploading || !form.image_url}
                className="w-full bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg py-3 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {uploading ? "Upload en cours…" : "Créer la bannière"}
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
      <label className="text-sm font-medium text-gray-700 block mb-1.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-afri-primary" />
    </div>
  );
}
