import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

import Landing from "./pages/Landing";
import Register from "./pages/auth/Register";
import Login from "./pages/auth/Login";
import VerifyOtp from "./pages/auth/VerifyOtp";

import BuyerHome from "./pages/buyer/Home";
import SearchPage from "./pages/buyer/Search";
import ProductDetail from "./pages/buyer/ProductDetail";
import Cart from "./pages/buyer/Cart";
import Checkout from "./pages/buyer/Checkout";
import BuyerOrders from "./pages/buyer/Orders";
import OrderDetail from "./pages/buyer/OrderDetail";
import OrderGroup from "./pages/buyer/OrderGroup";
import Profile from "./pages/buyer/Profile";

import SellerSetup from "./pages/seller/Setup";
import SellerDashboard from "./pages/seller/Dashboard";
import SellerProducts from "./pages/seller/Products";
import SellerAddProduct from "./pages/seller/AddProduct";
import SellerOrders from "./pages/seller/SellerOrders";
import SellerWallet from "./pages/seller/Wallet";
import SellerKyc from "./pages/seller/Kyc";
import SellerScan from "./pages/seller/Scan";

import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminSellers from "./pages/admin/Sellers";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminKyc from "./pages/admin/Kyc";
import AdminDisputes from "./pages/admin/Disputes";
import AdminFraud from "./pages/admin/Fraud";
import AdminDeliverers from "./pages/admin/Deliverers";
import AdminGeo from "./pages/admin/Geo";

import Messages from "./pages/Messages";
import ChatThread from "./pages/ChatThread";
import OpenDispute from "./pages/buyer/OpenDispute";
import DelivererDashboard from "./pages/deliverer/Dashboard";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Chargement…
      </div>
    );
  }
  if (!user) return <Landing />;
  if (user.role === "admin") return <Navigate to="/admin/overview" replace />;
  if (user.role === "seller") return <Navigate to="/seller/dashboard" replace />;
  if (user.role === "deliverer") return <Navigate to="/livreur" replace />;
  return <Navigate to="/buyer/home" replace />;
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/verify" element={<VerifyOtp />} />

            <Route path="/buyer/home" element={<ProtectedRoute roles={["buyer", "seller", "admin"]}><BuyerHome /></ProtectedRoute>} />
            <Route path="/buyer/search" element={<ProtectedRoute roles={["buyer", "seller", "admin"]}><SearchPage /></ProtectedRoute>} />
            <Route path="/buyer/product/:id" element={<ProtectedRoute roles={["buyer", "seller", "admin"]}><ProductDetail /></ProtectedRoute>} />
            <Route path="/buyer/cart" element={<ProtectedRoute roles={["buyer"]}><Cart /></ProtectedRoute>} />
            <Route path="/buyer/checkout" element={<ProtectedRoute roles={["buyer"]}><Checkout /></ProtectedRoute>} />
            <Route path="/buyer/orders" element={<ProtectedRoute roles={["buyer"]}><BuyerOrders /></ProtectedRoute>} />
            <Route path="/buyer/orders/:id" element={<ProtectedRoute roles={["buyer", "seller"]}><OrderDetail /></ProtectedRoute>} />
            <Route path="/buyer/order-group/:groupId" element={<ProtectedRoute roles={["buyer"]}><OrderGroup /></ProtectedRoute>} />
            <Route path="/buyer/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            <Route path="/seller/setup" element={<ProtectedRoute roles={["seller"]}><SellerSetup /></ProtectedRoute>} />
            <Route path="/seller/dashboard" element={<ProtectedRoute roles={["seller"]}><SellerDashboard /></ProtectedRoute>} />
            <Route path="/seller/products" element={<ProtectedRoute roles={["seller"]}><SellerProducts /></ProtectedRoute>} />
            <Route path="/seller/products/new" element={<ProtectedRoute roles={["seller"]}><SellerAddProduct /></ProtectedRoute>} />
            <Route path="/seller/orders" element={<ProtectedRoute roles={["seller"]}><SellerOrders /></ProtectedRoute>} />
            <Route path="/seller/wallet" element={<ProtectedRoute roles={["seller"]}><SellerWallet /></ProtectedRoute>} />
            <Route path="/seller/kyc" element={<ProtectedRoute roles={["seller"]}><SellerKyc /></ProtectedRoute>} />
            <Route path="/seller/scan" element={<ProtectedRoute roles={["seller"]}><SellerScan /></ProtectedRoute>} />

            <Route path="/messages" element={<ProtectedRoute roles={["buyer", "seller"]}><Messages /></ProtectedRoute>} />
            <Route path="/messages/:conversationId" element={<ProtectedRoute roles={["buyer", "seller"]}><ChatThread /></ProtectedRoute>} />
            <Route path="/buyer/dispute/:orderId" element={<ProtectedRoute roles={["buyer"]}><OpenDispute /></ProtectedRoute>} />

            <Route path="/livreur" element={<ProtectedRoute roles={["deliverer"]}><DelivererDashboard /></ProtectedRoute>} />

            <Route path="/admin/overview" element={<ProtectedRoute roles={["admin"]}><AdminOverview /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/sellers" element={<ProtectedRoute roles={["admin"]}><AdminSellers /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute roles={["admin"]}><AdminOrders /></ProtectedRoute>} />
            <Route path="/admin/kyc" element={<ProtectedRoute roles={["admin"]}><AdminKyc /></ProtectedRoute>} />
            <Route path="/admin/disputes" element={<ProtectedRoute roles={["admin"]}><AdminDisputes /></ProtectedRoute>} />
            <Route path="/admin/fraud" element={<ProtectedRoute roles={["admin"]}><AdminFraud /></ProtectedRoute>} />
            <Route path="/admin/deliverers" element={<ProtectedRoute roles={["admin"]}><AdminDeliverers /></ProtectedRoute>} />
            <Route path="/admin/geo" element={<ProtectedRoute roles={["admin"]}><AdminGeo /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
