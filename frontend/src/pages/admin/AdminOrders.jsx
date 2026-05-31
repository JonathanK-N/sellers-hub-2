import { useEffect, useState } from "react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";
import { formatPrice, timeAgo } from "../../lib/format";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api.get("/admin/orders").then(({ data }) => setOrders(data)); }, []);

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10">
        <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Commandes</h1>
      </header>
      <main className="p-6 lg:p-10 max-w-7xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <Th>ID</Th><Th>Mode</Th><Th>Total</Th><Th>Commission</Th><Th>Statut</Th><Th>Escrow</Th><Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`admin-order-${o.id}`}>
                  <Td><code className="text-xs">{o.id.slice(0, 8)}</code></Td>
                  <Td>{o.delivery_mode === "delivery" ? "Livraison" : "Retrait"}</Td>
                  <Td className="font-semibold text-[#085041]">{formatPrice(o.total_amount, o.currency)}</Td>
                  <Td className="text-gray-600">{formatPrice(o.commission_amount, o.currency)}</Td>
                  <Td><span className="text-[10px] uppercase font-bold">{o.status}</span></Td>
                  <Td>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${o.escrow_status === "released" ? "bg-[#E1F5EE] text-[#1D9E75]" : "bg-amber-50 text-amber-700"}`}>
                      {o.escrow_status}
                    </span>
                  </Td>
                  <Td className="text-gray-500 text-xs">{timeAgo(o.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="p-8 text-center text-gray-500 text-sm">Aucune commande</div>}
        </div>
      </main>
    </div>
  );
}
const Th = ({ children }) => <th className="px-4 py-3 text-left font-semibold">{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-4 py-3 ${className}`}>{children}</td>;
