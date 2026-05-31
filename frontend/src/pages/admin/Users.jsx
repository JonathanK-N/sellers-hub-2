import { useEffect, useState } from "react";
import api from "../../lib/api";
import AdminSidebar from "../../components/AdminSidebar";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get("/admin/users").then(({ data }) => setUsers(data)); }, []);

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-[250px]">
      <AdminSidebar />
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 lg:px-10">
        <h1 className="font-display font-black text-xl lg:text-2xl text-[#085041]">Utilisateurs</h1>
      </header>
      <main className="p-6 lg:p-10 max-w-7xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <Th>Nom</Th><Th>Téléphone</Th><Th>Rôle</Th><Th>Pays</Th><Th>KYC</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`user-row-${u.id}`}>
                  <Td><span className="font-semibold text-gray-900">{u.name}</span></Td>
                  <Td className="text-gray-600">{u.phone}</Td>
                  <Td>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      u.role === "admin" ? "bg-purple-50 text-purple-700" : u.role === "seller" ? "bg-[#E1F5EE] text-[#1D9E75]" : "bg-blue-50 text-blue-700"
                    }`}>
                      {u.role === "buyer" ? "Acheteur" : u.role === "seller" ? "Vendeur" : "Admin"}
                    </span>
                  </Td>
                  <Td className="text-gray-600">{u.country_code}</Td>
                  <Td>Niv {u.kyc_level}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="p-8 text-center text-gray-500 text-sm">Aucun utilisateur</div>}
        </div>
      </main>
    </div>
  );
}
const Th = ({ children }) => <th className="px-4 py-3 text-left font-semibold">{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-4 py-3 ${className}`}>{children}</td>;
