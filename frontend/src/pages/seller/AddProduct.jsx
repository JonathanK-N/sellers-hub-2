import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Upload, X, Truck, Store } from "lucide-react";
import api, { formatApiError, API_BASE } from "../../lib/api";

const CATEGORIES = ["Général", "Électronique", "Vêtements", "Alimentation", "Maison", "Solaire", "Agriculture"];
const CURRENCIES = [
  { value: "FC", label: "FC" },
  { value: "USD", label: "USD" },
];

export default function SellerAddProduct() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "", description: "", price: "", currency: "FC",
    stock: 1, category: "Général",
    delivery_modes: ["delivery", "collect"],
  });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 5) { toast.error("Max 5 photos"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("afri_token");
      const res = await fetch(`${API_BASE}/seller/upload-photo`, {
        method: "POST", body: fd,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPhotos((p) => [...p, data]);
      toast.success("Photo ajoutée");
    } catch { toast.error("Erreur d'upload"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const removePhoto = (id) => setPhotos((p) => p.filter((x) => x.id !== id));

  const toggleMode = (mode) => {
    setForm((f) => {
      const has = f.delivery_modes.includes(mode);
      if (has && f.delivery_modes.length === 1) return f;
      const next = has ? f.delivery_modes.filter((m) => m !== mode) : [...f.delivery_modes, mode];
      return { ...f, delivery_modes: next };
    });
  };

  const submit = async () => {
    if (!form.name || !form.price) { toast.error("Nom et prix obligatoires"); return; }
    if (isCustomCategory && !customCategory.trim()) { toast.error("Indiquez le nom de la nouvelle catégorie"); return; }
    setLoading(true);
    try {
      await api.post("/products", {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        currency: form.currency,
        stock: Number(form.stock),
        category: form.category,
        photos: photos.map((p) => p.url),
        delivery_modes: form.delivery_modes,
      });
      toast.success("Produit publié");
      nav("/seller/products");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="mobile-shell bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to="/seller/products" className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center" data-testid="back-btn">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display font-black text-lg text-[#085041]">Nouveau produit</h1>
      </header>

      <div className="px-4 mt-4 space-y-4">
        {/* Photos */}
        <div>
          <label className="text-sm font-medium text-gray-700">Photos (max 5)</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                <img src={`${API_BASE.replace(/\/api$/, "")}${p.url}`} alt="" className="w-full h-full object-cover" />
                <button data-testid={`remove-photo-${p.id}`} onClick={() => removePhoto(p.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X size={12} />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <label data-testid="add-photo-btn" className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#1D9E75] hover:text-[#1D9E75] cursor-pointer transition-colors">
                <Upload size={20} />
                <span className="text-[10px] font-semibold mt-1">{uploading ? "..." : "Ajouter"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </div>
        </div>

        <Input label="Nom du produit *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="product-name-input" placeholder="Ex: Téléphone Samsung A14" />
        <Textarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} testid="product-description-input" placeholder="Détails, état, garantie…" />

        {/* Prix + devise */}
        <div>
          <label className="text-sm font-medium text-gray-700">Prix *</label>
          <div className="flex gap-2 mt-1.5">
            <input
              data-testid="product-price-input"
              value={form.price} type="number"
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder={form.currency === "USD" ? "Ex: 25.00" : "Ex: 50000"}
              className="flex-1 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none"
            />
            <select
              data-testid="product-currency-select"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 bg-white text-sm font-bold focus:ring-2 focus:ring-[#1D9E75] outline-none text-[#085041] min-w-[64px]"
            >
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {form.currency === "USD" ? "Affiché en dollars américains ($)" : "Affiché en francs congolais (FC)"}
          </p>
        </div>

        <Input label="Stock" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} testid="product-stock-input" type="number" />

        <div>
          <label className="text-sm font-medium text-gray-700">Catégorie</label>
          <select data-testid="product-category-select" value={isCustomCategory ? "__other__" : form.category}
            onChange={(e) => {
              if (e.target.value === "__other__") { setIsCustomCategory(true); setCustomCategory(""); }
              else { setIsCustomCategory(false); setForm({ ...form, category: e.target.value }); }
            }}
            className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] outline-none">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            <option value="__other__">Autre…</option>
          </select>
          {isCustomCategory && (
            <input data-testid="product-custom-category-input" value={customCategory}
              onChange={(e) => { setCustomCategory(e.target.value); setForm({ ...form, category: e.target.value }); }}
              placeholder="Nom de la nouvelle catégorie"
              className="w-full mt-2 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] outline-none" autoFocus />
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Disponible en</label>
          <p className="text-xs text-gray-500 mt-0.5 mb-2">Choisissez comment ce produit peut être obtenu par l'acheteur.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" data-testid="product-mode-delivery" onClick={() => toggleMode("delivery")}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${form.delivery_modes.includes("delivery") ? "border-[#1D9E75] bg-[#E1F5EE]" : "border-gray-200 bg-white"}`}>
              <Truck size={18} className={form.delivery_modes.includes("delivery") ? "text-[#1D9E75]" : "text-gray-400"} />
              <span className={`text-xs font-semibold ${form.delivery_modes.includes("delivery") ? "text-[#085041]" : "text-gray-600"}`}>Livraison</span>
            </button>
            <button type="button" data-testid="product-mode-collect" onClick={() => toggleMode("collect")}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${form.delivery_modes.includes("collect") ? "border-[#1D9E75] bg-[#E1F5EE]" : "border-gray-200 bg-white"}`}>
              <Store size={18} className={form.delivery_modes.includes("collect") ? "text-[#1D9E75]" : "text-gray-400"} />
              <span className={`text-xs font-semibold ${form.delivery_modes.includes("collect") ? "text-[#085041]" : "text-gray-600"}`}>Retrait boutique</span>
            </button>
          </div>
        </div>

        <button data-testid="publish-product-btn" disabled={loading} onClick={submit}
          className="w-full bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50">
          {loading ? "Publication…" : "Publier le produit"}
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, testid, type = "text" }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input data-testid={testid} value={value} type={type} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none" />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, testid }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={3}
        className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 bg-white text-sm focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent outline-none resize-none" />
    </div>
  );
}
