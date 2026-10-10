import { useEffect, useState } from "react";
import {
  Search, Shield, Ban, Eye, Download, RefreshCw,
  CheckCircle2, MessageCircle, Lock, Trash2, X,
} from "lucide-react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { timeAgo } from "../../lib/format";
import { toast } from "sonner";

const ROLE_LABELS = { buyer: "Acheteur", seller: "Vendeur", deliverer: "Livreur", admin: "Admin" };
const ROLE_COLORS = {
  buyer:     "bg-blue-50 text-blue-700",
  seller:    "bg-afri-soft text-afri-primary",
  deliverer: "bg-amber-50 text-amber-700",
  admin:     "bg-purple-50 text-purple-700",
};

// ── WhatsApp helpers ──────────────────────────────────────────────────────────
const ROLE_FR = { buyer: "acheteur", seller: "vendeur", deliverer: "livreur" };

function waOpen(phone, msg) {
  let num = (phone || "").replace(/\s/g, "");
  if (!num.startsWith("+")) num = "+" + num;
  window.open(
    `https://wa.me/${num.replace("+", "")}?text=${encodeURIComponent(msg)}`,
    "_blank", "noopener"
  );
}

function waWelcome(u) {
  const role = ROLE_FR[u.role] || u.role;
  waOpen(u.phone,
    `Bonjour ${u.name} 👋,\n\n` +
    `Nous sommes ravis de vous accueillir sur *AfriMarket* en tant que ${role} !\n\n` +
    `🛍️ AfriMarket connecte acheteurs, vendeurs et livreurs à travers l'Afrique francophone.\n\n` +
    (u.role === "seller"
      ? `🏪 Votre boutique est prête. Ajoutez vos produits et complétez votre profil pour gagner en visibilité.\n\n`
      : u.role === "deliverer"
      ? `🚴 Consultez les commandes disponibles dans votre zone et démarrez vos premières livraisons.\n\n`
      : `🛒 Explorez les produits près de chez vous et profitez d'achats simples et sécurisés.\n\n`) +
    `📱 https://afrimarket.up.railway.app\n\n` +
    `Merci de faire confiance à AfriMarket ! 🌍\n— L'équipe AfriMarket`
  );
}

function waAction(u, act, motif) {
  const msgs = {
    suspend:
      `Bonjour ${u.name},\n\n⚠️ Votre compte *AfriMarket* a été *temporairement suspendu*.\n\n` +
      `📋 *Motif :* ${motif}\n\n` +
      `Pour contester, répondez à ce message.\n— L'équipe AfriMarket`,
    ban:
      `Bonjour ${u.name},\n\n🚫 Votre compte *AfriMarket* a été *définitivement banni*.\n\n` +
      `📋 *Motif :* ${motif}\n\n` +
      `Pour toute question : répondez à ce message.\n— L'équipe AfriMarket`,
    block:
      `Bonjour ${u.name},\n\n🔒 Votre compte *AfriMarket* a été *bloqué*.\n\n` +
      `📋 *Motif :* ${motif}\n\n` +
      `Répondez à ce message pour plus d'informations.\n— L'équipe AfriMarket`,
  };
  if (msgs[act]) waOpen(u.phone, msgs[act]);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users, setUsers]         = useState([]);
  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected]   = useState(null);
  const [busy, setBusy]           = useState(false);
  const [loading, setLoading]     = useState(true);

  // Modal action (suspend/ban/block) avec motif
  const [actionModal, setActionModal] = useState(null); // { user, act }
  const [motif, setMotif]             = useState("");

  // Modal produits vendeur
  const [productsModal, setProductsModal] = useState(null); // { user, products }
  const [loadingProducts, setLoadingProducts] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/admin/users").then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (!q || u.name?.toLowerCase().includes(q) || u.phone?.includes(q))
      && (roleFilter === "all" || u.role === roleFilter);
  });

  // Exécuter une action (suspend/ban/block/unsuspend)
  const doAction = async () => {
    if (!actionModal) return;
    const { user: u, act } = actionModal;
    if ((act === "suspend" || act === "ban" || act === "block") && !motif.trim()) {
      toast.error("Le motif est obligatoire");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/users/${u.id}/action`, { action: act, motif: motif.trim() });
      toast.success("Action effectuée");
      // Ouvrir WhatsApp automatiquement avec le motif
      if (act !== "unsuspend") waAction(u, act, motif.trim());
      load();
      setActionModal(null);
      setMotif("");
      setSelected(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };

  // Charger les produits d'un vendeur
  const openProducts = async (u) => {
    setProductsModal({ user: u, products: [] });
    setLoadingProducts(true);
    try {
      const { data } = await api.get(`/admin/sellers/${u.id}/products`);
      setProductsModal({ user: u, products: data });
    } catch { setProductsModal({ user: u, products: [] }); }
    finally { setLoadingProducts(false); }
  };

  // Retirer un produit
  const removeProduct = async (productId) => {
    if (!window.confirm("Retirer ce produit de la plateforme ?")) return;
    try {
      await api.patch(`/products/${productId}`, { is_active: false });
      toast.success("Produit retiré");
      setProductsModal((pm) => pm ? { ...pm, products: pm.products.map((p) => p.id === productId ? { ...p, is_active: false } : p) } : pm);
    } catch { toast.error("Erreur"); }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />

      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div className="pl-10 lg:pl-0">
          <h1 className="font-display font-black text-xl text-afri-secondary">Utilisateurs</h1>
          <p className="text-xs text-gray-500">{users.length} inscrits</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} className={`text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
          <a href="/api/admin/export/users"
            className="flex items-center gap-1.5 text-xs font-semibold text-afri-secondary border border-afri-primary px-3 py-1.5 rounded-lg hover:bg-afri-soft">
            <Download size={14} /> CSV
          </a>
        </div>
      </header>

      <main className="p-4 lg:p-8 max-w-7xl space-y-4">
        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, téléphone…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-afri-primary" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-afri-primary bg-white">
            <option value="all">Tous les rôles</option>
            <option value="buyer">Acheteurs</option>
            <option value="seller">Vendeurs</option>
            <option value="deliverer">Livreurs</option>
          </select>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">Utilisateur</th>
                  <th className="px-4 py-3 text-left">Rôle</th>
                  <th className="px-4 py-3 text-left">Pays</th>
                  <th className="px-4 py-3 text-left">Inscription</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun utilisateur</td></tr>
                ) : filtered.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`user-row-${u.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{u.country_code}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(u.created_at)}</td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <span className="text-[10px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full">Banni</span>
                      ) : u.suspended ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Suspendu</span>
                      ) : (
                        <span className="text-[10px] font-bold text-afri-primary bg-afri-soft px-2 py-0.5 rounded-full">Actif</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* WhatsApp bienvenue */}
                        <button
                          onClick={() => waWelcome(u)}
                          title="Envoyer un message de bienvenue WhatsApp"
                          className="p-1.5 hover:bg-green-50 rounded-lg text-green-600"
                        >
                          <MessageCircle size={15} />
                        </button>

                        {/* Voir détail */}
                        <button onClick={() => setSelected(u)} title="Voir profil"
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-black">
                          <Eye size={15} />
                        </button>

                        {/* Suspendre / Bloquer / Bannir */}
                        {!u.suspended && !u.banned && u.role !== "admin" && (
                          <>
                            <button onClick={() => { setActionModal({ user: u, act: "suspend" }); setMotif(""); }}
                              title="Suspendre" className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-500">
                              <Shield size={15} />
                            </button>
                            <button onClick={() => { setActionModal({ user: u, act: "ban" }); setMotif(""); }}
                              title="Bannir" className="p-1.5 hover:bg-red-50 rounded-lg text-red-500">
                              <Ban size={15} />
                            </button>
                          </>
                        )}

                        {/* Réactiver */}
                        {(u.suspended || u.banned) && u.role !== "admin" && (
                          <button onClick={() => { setActionModal({ user: u, act: "unsuspend" }); setMotif(""); }}
                            title="Réactiver" className="p-1.5 hover:bg-afri-soft rounded-lg text-afri-primary">
                            <CheckCircle2 size={15} />
                          </button>
                        )}

                        {/* Produits (vendeurs seulement) */}
                        {u.role === "seller" && (
                          <button onClick={() => openProducts(u)} title="Gérer les produits"
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                            <Lock size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Modal profil détail ──────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-display font-black text-lg text-afri-secondary">{selected.name}</h2>
                <p className="text-xs text-gray-500">{selected.phone} · #{selected.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Rôle" value={ROLE_LABELS[selected.role] || selected.role} />
                <Info label="Pays" value={selected.country_code} />
                <Info label="KYC" value={`Niveau ${selected.kyc_level ?? 0}`} />
                <Info label="Devise" value={selected.currency} />
                <Info label="Inscription" value={timeAgo(selected.created_at)} />
                <Info label="Statut" value={selected.banned ? "Banni" : selected.suspended ? "Suspendu" : "Actif"} />
              </div>

              {/* Actions rapides */}
              <div className="flex gap-2">
                <button onClick={() => waWelcome(selected)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold">
                  <MessageCircle size={15} /> WhatsApp bienvenue
                </button>
              </div>

              {!selected.suspended && !selected.banned && selected.role !== "admin" && (
                <div className="flex gap-2">
                  <button onClick={() => { setSelected(null); setActionModal({ user: selected, act: "suspend" }); setMotif(""); }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg py-2.5 text-sm font-semibold">
                    <Shield size={15} /> Suspendre
                  </button>
                  <button onClick={() => { setSelected(null); setActionModal({ user: selected, act: "ban" }); setMotif(""); }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg py-2.5 text-sm font-semibold">
                    <Ban size={15} /> Bannir
                  </button>
                </div>
              )}
              {(selected.suspended || selected.banned) && selected.role !== "admin" && (
                <button onClick={() => { setSelected(null); setActionModal({ user: selected, act: "unsuspend" }); setMotif(""); }}
                  className="w-full flex items-center justify-center gap-1.5 bg-afri-primary hover:bg-afri-primary-hover text-white rounded-lg py-2.5 text-sm font-semibold">
                  <CheckCircle2 size={15} /> Réactiver le compte
                </button>
              )}
              {selected.role === "seller" && (
                <button onClick={() => { setSelected(null); openProducts(selected); }}
                  className="w-full flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2.5 text-sm font-semibold">
                  <Lock size={15} /> Gérer les produits
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal action avec motif ──────────────────────────────────────────── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-black text-base text-gray-900">
                {actionModal.act === "suspend" && "Suspendre le compte"}
                {actionModal.act === "ban"     && "Bannir définitivement"}
                {actionModal.act === "block"   && "Bloquer le compte"}
                {actionModal.act === "unsuspend" && "Réactiver le compte"}
              </h2>
              <button onClick={() => setActionModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="font-semibold text-gray-900">{actionModal.user.name}</span>
                <span className="text-gray-500 ml-2">{actionModal.user.phone}</span>
              </div>

              {actionModal.act !== "unsuspend" && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                    Motif <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-1">(sera envoyé par WhatsApp)</span>
                  </label>
                  <textarea
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder={
                      actionModal.act === "suspend"
                        ? "Ex: Activité suspecte détectée sur votre compte…"
                        : "Ex: Violation grave des conditions d'utilisation…"
                    }
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-afri-primary resize-none"
                  />
                </div>
              )}

              {actionModal.act !== "unsuspend" && (
                <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs text-green-800">
                  <MessageCircle size={14} className="shrink-0 mt-0.5" />
                  Un message WhatsApp sera automatiquement ouvert pour notifier l'utilisateur.
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setActionModal(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
                  Annuler
                </button>
                <button
                  onClick={doAction}
                  disabled={busy || (actionModal.act !== "unsuspend" && !motif.trim())}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                    actionModal.act === "unsuspend"
                      ? "bg-afri-primary hover:bg-afri-primary-hover"
                      : actionModal.act === "ban"
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-amber-500 hover:bg-amber-600"
                  }`}>
                  {busy ? "Traitement…" : "Confirmer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal produits vendeur ───────────────────────────────────────────── */}
      {productsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-display font-black text-base text-gray-900">
                  Produits — {productsModal.user.name}
                </h2>
                <p className="text-xs text-gray-500">{productsModal.products.length} produits</p>
              </div>
              <button onClick={() => setProductsModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {loadingProducts ? (
                <div className="text-center py-8 text-gray-400 text-sm">Chargement…</div>
              ) : productsModal.products.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Aucun produit</div>
              ) : productsModal.products.map((p) => (
                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${p.is_active ? "border-gray-100 bg-white" : "border-red-100 bg-red-50"}`}>
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {p.photos?.[0]
                      ? <img src={p.photos[0].startsWith("http") ? p.photos[0] : `https://sellers-hub-2-production.up.railway.app${p.photos[0]}`} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-300 font-black font-display text-xl">A</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.price?.toLocaleString("fr-FR")} {p.currency} · Stock : {p.stock}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_active ? "bg-afri-soft text-afri-primary" : "bg-red-100 text-red-600"}`}>
                      {p.is_active ? "Actif" : "Retiré"}
                    </span>
                    {p.is_active && (
                      <button onClick={() => removeProduct(p.id)}
                        title="Retirer ce produit"
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900 text-sm">{value || "—"}</div>
    </div>
  );
}
