import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import InstallPrompt from "./components/InstallPrompt";
import "./App.css";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthModalProvider } from "./context/AuthModalContext";
import CartDrawerMount from "./components/cart/CartDrawerMount";
import SmoothScroll from "./components/SmoothScroll";
import PageBoundary from "./components/PageBoundary";
import { CartProvider } from "./context/CartContext";

import Landing from "./pages/Landing";
const Register = lazy(() => import("./pages/auth/Register"));
const Login = lazy(() => import("./pages/auth/Login"));
const VerifyOtp = lazy(() => import("./pages/auth/VerifyOtp"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));

const BuyerHome = lazy(() => import("./pages/buyer/Home"));
const SearchPage = lazy(() => import("./pages/buyer/Search"));
const ProductDetail = lazy(() => import("./pages/buyer/ProductDetail"));
const Cart = lazy(() => import("./pages/buyer/Cart"));
const Checkout = lazy(() => import("./pages/buyer/Checkout"));
const BuyerOrders = lazy(() => import("./pages/buyer/Orders"));
const OrderDetail = lazy(() => import("./pages/buyer/OrderDetail"));
const OrderGroup = lazy(() => import("./pages/buyer/OrderGroup"));
const Profile = lazy(() => import("./pages/buyer/Profile"));
const PaymentSuccess = lazy(() => import("./pages/buyer/PaymentSuccess"));
const PaymentFailed = lazy(() => import("./pages/buyer/PaymentFailed"));
const BuyerKycVerification = lazy(() => import("./pages/buyer/BuyerKycVerification"));
const BecomeDeliverer = lazy(() => import("./pages/BecomeDeliverer"));
const AdminDelivererApplications = lazy(() => import("./pages/admin/DelivererApplications"));
const SellerDelivererApplications = lazy(() => import("./pages/seller/DelivererApplications"));

const SellerSetup = lazy(() => import("./pages/seller/Setup"));
const SellerDashboard = lazy(() => import("./pages/seller/Dashboard"));
const SellerProducts = lazy(() => import("./pages/seller/Products"));
const SellerAddProduct = lazy(() => import("./pages/seller/AddProduct"));
const SellerEditProduct = lazy(() => import("./pages/seller/EditProduct"));
const SellerOrders = lazy(() => import("./pages/seller/SellerOrders"));
const SellerWallet = lazy(() => import("./pages/seller/Wallet"));
const SellerKyc = lazy(() => import("./pages/seller/Kyc"));
const SellerScan = lazy(() => import("./pages/seller/Scan"));
const SellerPremium = lazy(() => import("./pages/seller/Premium"));
const EditProfile = lazy(() => import("./pages/seller/EditProfile"));
const BuyerProfile = lazy(() => import("./pages/seller/BuyerProfile"));
const ShopProfile = lazy(() => import("./pages/buyer/ShopProfile"));

const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminSellers = lazy(() => import("./pages/admin/Sellers"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminKyc = lazy(() => import("./pages/admin/Kyc"));
const AdminDisputes = lazy(() => import("./pages/admin/Disputes"));
const AdminFraud = lazy(() => import("./pages/admin/Fraud"));
const AdminDeliverers = lazy(() => import("./pages/admin/Deliverers"));
const AdminGeo = lazy(() => import("./pages/admin/Geo"));
const AdminBuyerKyc = lazy(() => import("./pages/admin/BuyerKyc"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const AdminBanners = lazy(() => import("./pages/admin/Banners"));

const Messages = lazy(() => import("./pages/Messages"));
const ChatThread = lazy(() => import("./pages/ChatThread"));
const OpenDispute = lazy(() => import("./pages/buyer/OpenDispute"));
const DelivererDashboard = lazy(() => import("./pages/deliverer/Dashboard"));
const Notifications = lazy(() => import("./pages/Notifications"));

// Fetch the requested screen in parallel with session verification, without rendering it.
// Route guards still decide whether the user may see or load private data.
const initialScreenImports = {
  "/buyer/home": () => import("./pages/buyer/Home"),
  "/buyer/cart": () => import("./pages/buyer/Cart"),
  "/buyer/orders": () => import("./pages/buyer/Orders"),
  "/messages": () => import("./pages/Messages"),
  "/seller/dashboard": () => import("./pages/seller/Dashboard"),
  "/admin/overview": () => import("./pages/admin/Overview"),
};
initialScreenImports[window.location.pathname]?.().catch(() => {});
import { useParams as useQrParams } from "react-router-dom";

// Gestion du scan QR Click & Collect.
// L'URL encodée dans le QR est : /qr-collect/:orderId/:token
//   - Acheteur : redirigé vers sa page commande (pour voir le QR)
//   - Vendeur  : redirigé vers /seller/scan qui gère la caméra
//   - Non-connecté : redirigé vers login puis revient ici
function QrCollectRedirect() {
  const { orderId, token } = useQrParams();
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Chargement…
    </div>
  );
  if (!user) {
    return <Navigate to={`/auth/login?next=/qr-collect/${orderId}/${token}`} replace />;
  }
  if (user.role === "seller") {
    // Le vendeur va sur son scanner — il n'a pas besoin d'accéder à la commande buyer
    return <Navigate to="/seller/scan" replace />;
  }
  // Buyer, admin, deliverer → page de la commande
  return <Navigate to={`/buyer/orders/${orderId}`} replace />;
}

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
  if (roles?.length === 1 && roles[0] === "admin") return children;
  return <main id="main-content">{children}</main>;
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
          <AuthModalProvider>
          <Toaster position="top-center" richColors />
          <InstallPrompt />
          <SmoothScroll />
          <CartDrawerMount />
          <PageBoundary>
          <Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center text-afri-secondary">Chargement…</div>}>
          <Routes>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/verify" element={<VerifyOtp />} />
            <Route path="/auth/forgot" element={<ForgotPassword />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* ---- Visiteur (sans compte) : exploration publique ---- */}
            <Route path="/explore/search" element={<SearchPage guest />} />
            <Route path="/explore/product/:id" element={<ProductDetail guest />} />
            <Route path="/explore/shop/:sellerId" element={<ShopProfile guest />} />

            <Route path="/buyer/home" element={<ProtectedRoute roles={["buyer", "seller", "admin"]}><BuyerHome /></ProtectedRoute>} />
            <Route path="/buyer/search" element={<ProtectedRoute roles={["buyer", "seller", "admin"]}><SearchPage /></ProtectedRoute>} />
            <Route path="/buyer/product/:id" element={<ProtectedRoute roles={["buyer", "seller", "admin"]}><ProductDetail /></ProtectedRoute>} />
            <Route path="/buyer/cart" element={<ProtectedRoute roles={["buyer"]}><Cart /></ProtectedRoute>} />
            <Route path="/buyer/checkout" element={<ProtectedRoute roles={["buyer"]}><Checkout /></ProtectedRoute>} />
            <Route path="/buyer/orders" element={<ProtectedRoute roles={["buyer"]}><BuyerOrders /></ProtectedRoute>} />
            <Route path="/buyer/orders/:id" element={<ProtectedRoute roles={["buyer", "seller"]}><OrderDetail /></ProtectedRoute>} />
            <Route path="/buyer/order-group/:groupId" element={<ProtectedRoute roles={["buyer"]}><OrderGroup /></ProtectedRoute>} />
            <Route path="/buyer/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/buyer/kyc" element={<ProtectedRoute roles={["buyer"]}><BuyerKycVerification /></ProtectedRoute>} />
            <Route path="/become-deliverer" element={<ProtectedRoute><BecomeDeliverer /></ProtectedRoute>} />
            <Route path="/payment/success" element={<ProtectedRoute roles={["buyer"]}><PaymentSuccess /></ProtectedRoute>} />
            <Route path="/payment/failed" element={<ProtectedRoute roles={["buyer"]}><PaymentFailed /></ProtectedRoute>} />

            <Route path="/seller/setup" element={<ProtectedRoute roles={["seller"]}><SellerSetup /></ProtectedRoute>} />
            <Route path="/seller/dashboard" element={<ProtectedRoute roles={["seller"]}><SellerDashboard /></ProtectedRoute>} />
            <Route path="/seller/products" element={<ProtectedRoute roles={["seller"]}><SellerProducts /></ProtectedRoute>} />
            <Route path="/seller/products/new" element={<ProtectedRoute roles={["seller"]}><SellerAddProduct /></ProtectedRoute>} />
            <Route path="/seller/products/:id/edit" element={<ProtectedRoute roles={["seller"]}><SellerEditProduct /></ProtectedRoute>} />
            <Route path="/seller/orders" element={<ProtectedRoute roles={["seller"]}><SellerOrders /></ProtectedRoute>} />
            <Route path="/seller/wallet" element={<ProtectedRoute roles={["seller"]}><SellerWallet /></ProtectedRoute>} />
            <Route path="/seller/kyc" element={<ProtectedRoute roles={["seller"]}><SellerKyc /></ProtectedRoute>} />
            <Route path="/seller/scan" element={<ProtectedRoute roles={["seller"]}><SellerScan /></ProtectedRoute>} />
            <Route path="/seller/premium" element={<ProtectedRoute roles={["seller"]}><SellerPremium /></ProtectedRoute>} />
            <Route path="/seller/edit-profile" element={<ProtectedRoute roles={["seller"]}><EditProfile /></ProtectedRoute>} />
            <Route path="/seller/buyer/:buyerId" element={<ProtectedRoute roles={["seller"]}><BuyerProfile /></ProtectedRoute>} />
            <Route path="/seller/deliverer-applications" element={<ProtectedRoute roles={["seller"]}><SellerDelivererApplications /></ProtectedRoute>} />
            <Route path="/shop/:sellerId" element={<ShopProfile />} />

            <Route path="/messages" element={<ProtectedRoute roles={["buyer", "seller"]}><Messages /></ProtectedRoute>} />
            <Route path="/messages/:conversationId" element={<ProtectedRoute roles={["buyer", "seller"]}><ChatThread /></ProtectedRoute>} />
            <Route path="/buyer/dispute/:orderId" element={<ProtectedRoute roles={["buyer"]}><OpenDispute /></ProtectedRoute>} />

            <Route path="/livreur" element={<ProtectedRoute roles={["deliverer"]}><DelivererDashboard /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

            <Route path="/admin/overview" element={<ProtectedRoute roles={["admin"]}><AdminOverview /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/sellers" element={<ProtectedRoute roles={["admin"]}><AdminSellers /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute roles={["admin"]}><AdminOrders /></ProtectedRoute>} />
            <Route path="/admin/kyc" element={<ProtectedRoute roles={["admin"]}><AdminKyc /></ProtectedRoute>} />
            <Route path="/admin/buyer-kyc" element={<ProtectedRoute roles={["admin"]}><AdminBuyerKyc /></ProtectedRoute>} />
            <Route path="/admin/disputes" element={<ProtectedRoute roles={["admin"]}><AdminDisputes /></ProtectedRoute>} />
            <Route path="/admin/fraud" element={<ProtectedRoute roles={["admin"]}><AdminFraud /></ProtectedRoute>} />
            <Route path="/admin/deliverers" element={<ProtectedRoute roles={["admin"]}><AdminDeliverers /></ProtectedRoute>} />
            <Route path="/admin/deliverer-applications" element={<ProtectedRoute roles={["admin"]}><AdminDelivererApplications /></ProtectedRoute>} />
            <Route path="/admin/geo" element={<ProtectedRoute roles={["admin"]}><AdminGeo /></ProtectedRoute>} />
            <Route path="/admin/products" element={<ProtectedRoute roles={["admin"]}><AdminProducts /></ProtectedRoute>} />
            <Route path="/admin/banners" element={<ProtectedRoute roles={["admin"]}><AdminBanners /></ProtectedRoute>} />

            {/* QR Click & Collect — lien scannable par l'acheteur ou le vendeur */}
            <Route path="/qr-collect/:orderId/:token" element={<QrCollectRedirect />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          </PageBoundary>
          </AuthModalProvider>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
