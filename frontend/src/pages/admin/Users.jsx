import { useEffect, useState } from "react";
import { Search, Shield, Ban, Eye, Download, RefreshCw, CheckCircle2 } from "lucide-react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { timeAgo } from "../../lib/format";
import { toast } from "sonner";

const ROLE_LABELS = { buyer: "Acheteur", seller: "Vendeur", deliverer: "Livreur", admin: "Admin" };
const ROLE_COLORS = {
  buyer: "bg-blue-50 text-blue-700",
  seller: "bg-[#E1F5EE] text-[#1D9E75]",
  deliverer: "bg-amber-50 text-amber-700",
  admin: "bg-purple-50 text-purple-700",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/admin/users").then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.phone?.includes(q);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const action = async (userId, act) => {
    setBusy(true);
    try {
      await api.post(`/admin/users/${userId}/action`, { action: act });
      toast.success("Action effectuée");
      load();
      setSelected(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10 flex items-center justify-between">
        <div className="pl-10 lg:pl-0">
          <h1 className="font-display font-black text-xl text-[#085041]">Utilisateurs</h1>
          <p className="text-xs text-gray-500">{users.length} inscrits</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw size={16} className="text-gray-500" /></button>
          <a href="/api/admin/export/users" className="flex items-center gap-1.5 text-xs font-semibold text-[#085041] border border-[#085041] px-3 py-1.5 rounded-lg hover:bg-[#E1F5EE]">
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
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75] bg-white">
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
                  <th className="px-4 py-3 text-left">KYC</th>
                  <th className="px-4 py-3 text-left">Inscription</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Aucun utilisateur</td></tr>
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
                    <td className="px-4 py-3 text-gray-600">{u.country_code}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {u.kyc_level >= 2 && <CheckCircle2 size={14} className="text-[#1D9E75]" />}
                        <span className="text-xs">Niv {u.kyc_level}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(u.created_at)}</td>
                    <td className="px-4 py-3">
                      {u.suspended ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Suspendu</span>
                      ) : u.banned ? (
                        <span className="text-[10px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full">Banni</span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#1D9E75] bg-[#E1F5EE] px-2 py-0.5 rounded-full">Actif</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(u)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#085041]">
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal détail utilisateur */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-display font-black text-lg text-[#085041]">{selected.name}</h2>
                <p className="text-xs text-gray-500">{selected.phone} · {selected.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Rôle" value={ROLE_LABELS[selected.role] || selected.role} />
                <Info label="Pays" value={selected.country_code} />
                <Info label="KYC niveau" value={`Niveau ${selected.kyc_level}`} />
                <Info label="Devise" value={selected.currency} />
                <Info label="Inscription" value={timeAgo(selected.created_at)} />
                <Info label="Statut" value={selected.suspended ? "Suspendu" : selected.banned ? "Banni" : "Actif"} />
              </div>

              {selected.role === "buyer" && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-semibold text-gray-700 mb-1">KYC Acheteur</div>
                  <div className="text-gray-600">Statut : {selected.buyer_kyc_status || "non soumis"}</div>
                  {selected.buyer_verified && <div className="text-[#1D9E75] font-semibold flex items-center gap-1 mt-1"><CheckCircle2 size={14} /> Identité vérifiée</div>}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                {!selected.suspended && !selected.banned && (
                  <>
                    <button disabled={busy} onClick={() => action(selected.id, "suspend")}
                      className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50">
                      <Shield size={16} /> Suspendre le compte
                    </button>
                    <button disabled={busy} onClick={() => action(selected.id, "ban")}
                      className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50">
                      <Ban size={16} /> Bannir définitivement
                    </button>
                  </>
                )}
                {selected.suspended && (
                  <button disabled={busy} onClick={() => action(selected.id, "unsuspend")}
                    className="w-full flex items-center justify-center gap-2 bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50">
                    <CheckCircle2 size={16} /> Réactiver le compte
                  </button>
                )}
              </div>
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
      <div className="font-semibold text-gray-900">{value || "—"}</div>
    </div>
  );
}
