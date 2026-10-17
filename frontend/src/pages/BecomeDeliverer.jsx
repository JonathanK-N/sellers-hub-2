import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Truck, ShieldCheck, ChevronRight, ChevronLeft, Check, Upload,
  Camera, FileText, User, Phone, MapPin, Calendar, Mail,
  Store, Globe, Clock, RefreshCw, X, Loader2, PartyPopper,
} from "lucide-react";
import api, { formatApiError, API_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const STEPS = ["intro", "type", "identity", "phone", "documents", "selfie", "contract", "review", "done"];

const BENEFITS = [
  { icon: Truck, title: "Revenus à la livraison", desc: "11 500 FC par livraison confirmée, versés directement dans votre wallet." },
  { icon: ShieldCheck, title: "Paiement garanti", desc: "Chaque livraison est protégée par notre système d'escrow." },
  { icon: Clock, title: "Liberté totale", desc: "Choisissez vos horaires, livrez quand vous le souhaitez." },
  { icon: Globe, title: "Réseau national", desc: "Accès aux commandes de toutes les boutiques partenaires AfriMarket." },
];

function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? "w-6 bg-white" : i < current ? "w-1.5 bg-white/70" : "w-1.5 bg-white/25"
          }`}
        />
      ))}
    </div>
  );
}

function FadeStep({ children }) {
  return <div className="animate-[fadeSlideIn_0.4s_ease-out]">{children}</div>;
}

export default function BecomeDeliverer() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [sellerQuery, setSellerQuery] = useState("");

  const [form, setForm] = useState({
    application_type: new URLSearchParams(window.location.search).has("shop") ? "shop" : "afrimarket",
    seller_id: new URLSearchParams(window.location.search).get("shop"),
    full_name: user?.name || "",
    date_of_birth: "",
    address: "",
    phone: user?.phone || "",
    email: "",
    vehicle: "moto",
  });

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpDev, setOtpDev] = useState(null);
  const [resendIn, setResendIn] = useState(0);

  const [docs, setDocs] = useState({ id_document: null, selfie: null });
  const [contractAccepted, setContractAccepted] = useState(false);
  const [contractScrolled, setContractScrolled] = useState(false);

  // Resume an existing application if present
  useEffect(() => {
    api.get("/deliverer-applications/me").then(({ data }) => {
      if (data && data.status === "pending") {
        setApplication(data);
        setStepIdx(STEPS.indexOf("review"));
      } else if (data && data.status === "approved") {
        setApplication(data);
        setStepIdx(STEPS.indexOf("done"));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const step = STEPS[stepIdx];
  const goNext = () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const goBack = () => setStepIdx((i) => Math.max(0, i - 1));

  // ---------- Step: type (afrimarket vs shop) ----------
  useEffect(() => {
    if (form.application_type !== "shop" || sellers.length || sellerQuery.length < 2) return;
  }, [form.application_type]);

  const searchSellers = async (q) => {
    setSellerQuery(q);
    if (q.length < 2) { setSellers([]); return; }
    try {
      const { data } = await api.get("/products", { params: { q, limit: 1 } });
      // fallback: use seller search via products listing won't return sellers directly;
      // use a lightweight endpoint instead if available
    } catch {}
  };

  // ---------- Create draft application ----------
  const ensureApplication = async () => {
    if (application?.id) return application;
    setLoading(true);
    try {
      const { data } = await api.post("/deliverer-applications", {
        application_type: form.application_type,
        seller_id: form.application_type === "shop" ? form.seller_id : null,
        full_name: form.full_name,
        date_of_birth: form.date_of_birth,
        address: form.address,
        phone: form.phone,
        email: form.email || null,
        vehicle: form.vehicle,
      });
      setApplication(data);
      return data;
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ---------- Identity step validation ----------
  const submitIdentity = async () => {
    if (!form.full_name || !form.date_of_birth || !form.address) {
      toast.error("Tous les champs sont obligatoires");
      return;
    }
    const app = await ensureApplication();
    if (app) goNext();
  };

  // ---------- Phone OTP ----------
  const sendOtp = async () => {
    if (!form.phone) {
      toast.error("Entrez un numéro de téléphone");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/deliverer-applications/send-otp", { phone: form.phone });
      setOtpSent(true);
      setResendIn(30);
      if (data.otp_dev) {
        setOtpDev(data.otp_dev);
        toast.success(`Code envoyé (démo : ${data.otp_dev})`);
      } else {
        toast.success("Code envoyé par SMS");
      }
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Le code doit comporter 6 chiffres");
      return;
    }
    setLoading(true);
    try {
      await api.post("/deliverer-applications/verify-otp", { phone: form.phone, code: otpCode });
      setOtpVerified(true);
      toast.success("Numéro vérifié !");
      setTimeout(goNext, 600);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  // ---------- Document upload ----------
  const uploadDoc = async (docType, file) => {
    const app = await ensureApplication();
    if (!app) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("afri_token");
      const res = await fetch(`${API_BASE}/deliverer-applications/${app.id}/upload?doc_type=${docType}`, {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setDocs((d) => ({ ...d, [docType]: URL.createObjectURL(file) }));
      toast.success(docType === "id_document" ? "Pièce d'identité reçue" : "Selfie reçu");
    } catch (e) {
      toast.error("Échec du téléversement");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Contract acceptance ----------
  const acceptContract = async () => {
    if (!contractAccepted) {
      toast.error("Vous devez accepter les conditions pour continuer");
      return;
    }
    const app = await ensureApplication();
    if (!app) return;
    setLoading(true);
    try {
      await api.post(`/deliverer-applications/${app.id}/accept-contract`);
      goNext();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  // ---------- Final submission ----------
  const finalSubmit = async () => {
    if (!application?.id) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/deliverer-applications/${application.id}/submit`);
      setApplication(data);
      goNext();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(29,158,117,0.4); }
          70% { box-shadow: 0 0 0 14px rgba(29,158,117,0); }
          100% { box-shadow: 0 0 0 0 rgba(29,158,117,0); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      <div className="mobile-shell !pb-10">
        {/* HEADER */}
        <header className="sticky top-0 z-40 bg-linear-to-br from-afri-secondary to-afri-primary text-white px-4 pt-4 pb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-white/15 flex items-center justify-center font-black">A</div>
              <span className="font-display font-black text-lg tracking-tight">AfriMarket</span>
            </div>
            {step !== "intro" && step !== "done" && (
              <Link to="/" className="text-white/70 hover:text-white">
                <X size={20} />
              </Link>
            )}
          </div>
          {step !== "intro" && step !== "done" && (
            <StepDots current={Math.max(0, stepIdx - 1)} total={STEPS.length - 2} />
          )}
        </header>

        <div className="px-4 mt-5">
          {/* ============ INTRO ============ */}
          {step === "intro" && (
            <FadeStep>
              <div className="text-center" style={{ animation: "floatSlow 4s ease-in-out infinite" }}>
                <div className="w-20 h-20 mx-auto rounded-2xl bg-afri-primary flex items-center justify-center text-white shadow-xl" style={{ animation: "pulseRing 2.5s infinite" }}>
                  <Truck size={36} />
                </div>
              </div>
              <h1 className="font-display font-black text-2xl text-center text-gray-900 mt-5 leading-tight">
                Devenez livreur AfriMarket
              </h1>
              <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
                Rejoignez notre réseau de livreurs et générez des revenus en livrant les commandes des boutiques partenaires.
              </p>

              <div className="grid grid-cols-1 gap-3 mt-7">
                {BENEFITS.map((b, i) => (
                  <div
                    key={b.title}
                    className="bg-white rounded-xl border border-gray-100 shadow-xs p-4 flex items-start gap-3"
                    style={{ animation: `fadeSlideIn 0.4s ease-out ${i * 0.08}s both` }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-afri-soft text-afri-primary flex items-center justify-center shrink-0">
                      <b.icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{b.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                data-testid="start-application-btn"
                onClick={goNext}
                className="w-full mt-7 bg-afri-primary hover:bg-afri-primary-hover text-white rounded-xl py-3.5 font-semibold transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                Commencer ma candidature <ChevronRight size={18} />
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-3">
                Cela prend environ 5 minutes. Vous pourrez reprendre plus tard si besoin.
              </p>
            </FadeStep>
          )}

          {/* ============ TYPE ============ */}
          {step === "type" && (
            <FadeStep>
              <h2 className="font-display font-bold text-xl text-gray-900">Quel type de livreur souhaitez-vous être ?</h2>
              <p className="text-sm text-gray-500 mt-1.5">Choisissez le parcours qui vous correspond.</p>

              <div className="space-y-3 mt-5">
                <button
                  data-testid="type-afrimarket-btn"
                  onClick={() => setForm((f) => ({ ...f, application_type: "afrimarket", seller_id: null }))}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    form.application_type === "afrimarket" ? "border-afri-primary bg-afri-soft" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${form.application_type === "afrimarket" ? "bg-afri-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                      <Globe size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Livreur réseau AfriMarket</p>
                      <p className="text-xs text-gray-500 mt-1">Livrez pour toutes les boutiques partenaires. Validation par l'équipe AfriMarket.</p>
                    </div>
                  </div>
                </button>

                <button
                  data-testid="type-shop-btn"
                  onClick={() => setForm((f) => ({ ...f, application_type: "shop" }))}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    form.application_type === "shop" ? "border-afri-primary bg-afri-soft" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${form.application_type === "shop" ? "bg-afri-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                      <Store size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Livreur exclusif d'une boutique</p>
                      <p className="text-xs text-gray-500 mt-1">Livrez uniquement pour une boutique spécifique. Validation par le vendeur.</p>
                    </div>
                  </div>
                </button>
              </div>

              {form.application_type === "shop" && (
                <div className="mt-4 animate-[fadeSlideIn_0.3s_ease-out]">
                  <label className="text-sm font-medium text-gray-700">ID de la boutique</label>
                  <input
                    data-testid="shop-id-input"
                    value={form.seller_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, seller_id: e.target.value }))}
                    placeholder="Demandez l'ID à votre boutique partenaire"
                    className="w-full mt-1.5 border border-gray-300 rounded-lg p-3 text-sm outline-hidden focus:ring-2 focus:ring-afri-primary"
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5">Le vendeur peut vous communiquer cet identifiant depuis son tableau de bord.</p>
                </div>
              )}

              <div className="flex gap-2 mt-7">
                <button onClick={goBack} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                  <ChevronLeft size={20} />
                </button>
                <button
                  data-testid="type-continue-btn"
                  disabled={form.application_type === "shop" && !form.seller_id}
                  onClick={goNext}
                  className="flex-1 bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-40 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
                >
                  Continuer <ChevronRight size={18} />
                </button>
              </div>
            </FadeStep>
          )}

          {/* ============ IDENTITY ============ */}
          {step === "identity" && (
            <FadeStep>
              <h2 className="font-display font-bold text-xl text-gray-900">Vos informations</h2>
              <p className="text-sm text-gray-500 mt-1.5">Telles qu'elles apparaissent sur votre pièce d'identité.</p>

              <div className="space-y-3 mt-5">
                <Field icon={User} label="Nom complet" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} placeholder="Ex: Jean Mutombo Kasongo" testid="full-name-input" />
                <Field icon={Calendar} label="Date de naissance" type="date" value={form.date_of_birth} onChange={(v) => setForm((f) => ({ ...f, date_of_birth: v }))} testid="dob-input" />
                <Field icon={MapPin} label="Adresse complète" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="Quartier, avenue, commune" testid="address-input" />
                <Field icon={Mail} label="Email (optionnel)" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="vous@email.com" testid="email-input" />

                <div>
                  <label className="text-sm font-medium text-gray-700">Véhicule</label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {[{ v: "moto", l: "Moto" }, { v: "velo", l: "Vélo" }, { v: "pied", l: "À pied" }].map((opt) => (
                      <button
                        key={opt.v}
                        data-testid={`vehicle-${opt.v}`}
                        onClick={() => setForm((f) => ({ ...f, vehicle: opt.v }))}
                        className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                          form.vehicle === opt.v ? "bg-afri-secondary text-white border-afri-secondary" : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-7">
                <button onClick={goBack} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                  <ChevronLeft size={20} />
                </button>
                <button
                  data-testid="identity-continue-btn"
                  disabled={loading}
                  onClick={submitIdentity}
                  className="flex-1 bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-50 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Continuer <ChevronRight size={18} /></>}
                </button>
              </div>
            </FadeStep>
          )}

          {/* ============ PHONE OTP ============ */}
          {step === "phone" && (
            <FadeStep>
              <h2 className="font-display font-bold text-xl text-gray-900">Vérification du numéro</h2>
              <p className="text-sm text-gray-500 mt-1.5">Nous devons confirmer que ce numéro vous appartient.</p>

              <div className="mt-5">
                <Field icon={Phone} label="Numéro de téléphone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="+243 8XX XXX XXX" testid="phone-input" disabled={otpSent} />
              </div>

              {!otpSent ? (
                <button
                  data-testid="send-otp-btn"
                  disabled={loading}
                  onClick={sendOtp}
                  className="w-full mt-5 bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-50 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Envoyer le code"}
                </button>
              ) : (
                <div className="mt-5 animate-[fadeSlideIn_0.3s_ease-out]">
                  <label className="text-sm font-medium text-gray-700">Code reçu par SMS</label>
                  <input
                    data-testid="otp-input"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 chiffres"
                    maxLength={6}
                    className="w-full mt-1.5 border border-gray-300 rounded-lg p-3.5 text-center text-2xl font-bold tracking-[0.4em] outline-hidden focus:ring-2 focus:ring-afri-primary"
                  />
                  {otpDev && <p className="text-[11px] text-amber-600 text-center mt-1.5">Mode démo — code : {otpDev}</p>}
                  <button
                    data-testid="verify-otp-btn"
                    disabled={loading || otpCode.length !== 6}
                    onClick={verifyOtp}
                    className={`w-full mt-4 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 transition-colors ${
                      otpVerified ? "bg-emerald-500 text-white" : "bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-40 text-white"
                    }`}
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : otpVerified ? <><Check size={18} /> Vérifié</> : "Valider le code"}
                  </button>
                  <button
                    onClick={sendOtp}
                    disabled={resendIn > 0}
                    className="w-full mt-2 text-xs text-gray-500 disabled:opacity-40 flex items-center justify-center gap-1.5 py-2"
                  >
                    <RefreshCw size={12} /> {resendIn > 0 ? `Renvoyer dans ${resendIn}s` : "Renvoyer le code"}
                  </button>
                </div>
              )}

              <div className="flex gap-2 mt-5">
                <button onClick={goBack} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                  <ChevronLeft size={20} />
                </button>
              </div>
            </FadeStep>
          )}

          {/* ============ DOCUMENTS ============ */}
          {step === "documents" && (
            <FadeStep>
              <h2 className="font-display font-bold text-xl text-gray-900">Pièce d'identité</h2>
              <p className="text-sm text-gray-500 mt-1.5">Carte d'identité, passeport, ou permis de conduire en cours de validité.</p>

              <div className="mt-5">
                {docs.id_document ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-afri-primary">
                    <img src={docs.id_document} alt="Pièce d'identité" className="w-full h-48 object-cover" />
                    <div className="absolute top-2 right-2 bg-afri-primary text-white rounded-full p-1.5">
                      <Check size={14} />
                    </div>
                    <label className="absolute bottom-2 right-2 bg-white/90 backdrop-blur text-xs font-semibold text-gray-700 px-3 py-1.5 rounded-full cursor-pointer">
                      Changer
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadDoc("id_document", e.target.files[0])} />
                    </label>
                  </div>
                ) : (
                  <label
                    data-testid="upload-id-document-btn"
                    className="flex flex-col items-center justify-center gap-2 h-48 rounded-xl border-2 border-dashed border-gray-300 hover:border-afri-primary cursor-pointer transition-colors bg-white"
                  >
                    {loading ? <Loader2 size={28} className="text-afri-primary animate-spin" /> : <FileText size={28} className="text-gray-400" />}
                    <span className="text-sm font-semibold text-gray-600">Téléverser la pièce d'identité</span>
                    <span className="text-[11px] text-gray-400">JPG, PNG — max 10 Mo</span>
                    <input type="file" accept="image/*" className="hidden" disabled={loading} onChange={(e) => e.target.files?.[0] && uploadDoc("id_document", e.target.files[0])} />
                  </label>
                )}
              </div>

              <div className="flex gap-2 mt-7">
                <button onClick={goBack} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                  <ChevronLeft size={20} />
                </button>
                <button
                  data-testid="documents-continue-btn"
                  disabled={!docs.id_document}
                  onClick={goNext}
                  className="flex-1 bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-40 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
                >
                  Continuer <ChevronRight size={18} />
                </button>
              </div>
            </FadeStep>
          )}

          {/* ============ SELFIE (placeholder, webcam component plugged in part 2) ============ */}
          {step === "selfie" && (
            <SelfieCapture
              onCaptured={(file) => uploadDoc("selfie", file)}
              captured={docs.selfie}
              loading={loading}
              onBack={goBack}
              onNext={goNext}
            />
          )}

          {/* ============ CONTRACT ============ */}
          {step === "contract" && (
            <FadeStep>
              <h2 className="font-display font-bold text-xl text-gray-900">Contrat & politique AfriMarket</h2>
              <p className="text-sm text-gray-500 mt-1.5">Merci de lire attentivement avant d'accepter.</p>

              <div
                onScroll={(e) => {
                  const el = e.target;
                  if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) setContractScrolled(true);
                }}
                className="mt-4 bg-white rounded-xl border border-gray-200 p-4 h-72 overflow-y-auto text-xs text-gray-600 leading-relaxed space-y-3"
              >
                <p className="font-bold text-gray-900">1. Objet</p>
                <p>Le présent contrat régit la relation entre le Livreur indépendant et AfriMarket (Cognito Inc.) pour la réalisation de prestations de livraison de colis pour le compte des boutiques partenaires de la plateforme.</p>
                <p className="font-bold text-gray-900">2. Statut du livreur</p>
                <p>Le Livreur exerce son activité de manière indépendante et n'est lié à AfriMarket par aucun contrat de travail. Il demeure libre d'accepter ou de refuser toute livraison proposée.</p>
                <p className="font-bold text-gray-900">3. Rémunération</p>
                <p>Le Livreur perçoit 11 500 FC par livraison confirmée par le client, créditée automatiquement sur son portefeuille AfriMarket. Le retrait des fonds s'effectue selon les modalités décrites dans l'application.</p>
                <p className="font-bold text-gray-900">4. Obligations du livreur</p>
                <p>Le Livreur s'engage à traiter les colis avec soin, à respecter les délais annoncés, à se présenter avec une pièce d'identité valide, et à utiliser le code de confirmation remis par le client comme preuve de livraison.</p>
                <p className="font-bold text-gray-900">5. Protection des données</p>
                <p>Les données personnelles et documents d'identité transmis sont traités de manière confidentielle et stockés de façon sécurisée, exclusivement aux fins de vérification d'identité et de sécurité de la plateforme.</p>
                <p className="font-bold text-gray-900">6. Résiliation</p>
                <p>AfriMarket se réserve le droit de suspendre ou de mettre fin à l'accès du Livreur à la plateforme en cas de manquement grave aux présentes conditions, de fraude avérée, ou de plaintes répétées et fondées de la clientèle.</p>
                <p className="font-bold text-gray-900">7. Acceptation</p>
                <p>En cochant la case ci-dessous, le candidat reconnaît avoir lu, compris, et accepté l'intégralité des termes du présent contrat.</p>
              </div>

              <label className="flex items-start gap-3 mt-4 cursor-pointer">
                <input
                  data-testid="accept-contract-checkbox"
                  type="checkbox"
                  checked={contractAccepted}
                  disabled={!contractScrolled}
                  onChange={(e) => setContractAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded accent-afri-primary"
                />
                <span className="text-sm text-gray-700">
                  J'ai lu et j'accepte les termes du contrat et la politique AfriMarket.
                  {!contractScrolled && <span className="text-[11px] text-amber-600 block mt-0.5">Faites défiler jusqu'en bas pour activer la case.</span>}
                </span>
              </label>

              <div className="flex gap-2 mt-6">
                <button onClick={goBack} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                  <ChevronLeft size={20} />
                </button>
                <button
                  data-testid="contract-continue-btn"
                  disabled={!contractAccepted || loading}
                  onClick={acceptContract}
                  className="flex-1 bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-40 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Continuer <ChevronRight size={18} /></>}
                </button>
              </div>
            </FadeStep>
          )}

          {/* ============ REVIEW / SUBMIT ============ */}
          {step === "review" && (
            <FadeStep>
              {application?.status === "pending" ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center" style={{ animation: "pulseRing 2.5s infinite" }}>
                    <Clock size={32} />
                  </div>
                  <h2 className="font-display font-bold text-xl text-gray-900 mt-5">Candidature en cours d'examen</h2>
                  <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
                    {form.application_type === "afrimarket"
                      ? "Notre équipe examine votre dossier. Vous recevrez une notification dès qu'une décision sera prise."
                      : "Le vendeur examine votre dossier. Vous recevrez une notification dès qu'une décision sera prise."}
                  </p>
                  <Link to="/buyer/profile" className="inline-block mt-6 text-afri-primary font-semibold text-sm">
                    Retour à mon profil
                  </Link>
                </div>
              ) : (
                <>
                  <h2 className="font-display font-bold text-xl text-gray-900">Récapitulatif</h2>
                  <p className="text-sm text-gray-500 mt-1.5">Vérifiez vos informations avant l'envoi final.</p>

                  <div className="mt-5 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    <ReviewRow label="Type" value={form.application_type === "afrimarket" ? "Réseau AfriMarket" : "Boutique exclusive"} />
                    <ReviewRow label="Nom complet" value={form.full_name} />
                    <ReviewRow label="Date de naissance" value={form.date_of_birth} />
                    <ReviewRow label="Adresse" value={form.address} />
                    <ReviewRow label="Téléphone" value={form.phone} verified={otpVerified} />
                    <ReviewRow label="Véhicule" value={form.vehicle} />
                    <ReviewRow label="Pièce d'identité" value={docs.id_document ? "Téléversée ✓" : "Manquante"} />
                    <ReviewRow label="Selfie" value={docs.selfie ? "Téléversé ✓" : "Manquant"} />
                  </div>

                  <button
                    data-testid="final-submit-btn"
                    disabled={loading}
                    onClick={finalSubmit}
                    className="w-full mt-6 bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-50 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 shadow-md"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Envoyer ma candidature"}
                  </button>
                </>
              )}
            </FadeStep>
          )}

          {/* ============ DONE ============ */}
          {step === "done" && (
            <FadeStep>
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-afri-soft text-afri-primary flex items-center justify-center" style={{ animation: "pulseRing 2.5s infinite" }}>
                  <PartyPopper size={32} />
                </div>
                <h2 className="font-display font-bold text-2xl text-gray-900 mt-5">
                  {application?.status === "approved" ? "Vous êtes livreur AfriMarket !" : "Candidature envoyée !"}
                </h2>
                <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
                  {application?.status === "approved"
                    ? "Votre compte livreur est actif. Vous pouvez dès maintenant accepter des livraisons."
                    : "Nous reviendrons vers vous très rapidement par notification et email."}
                </p>
                <Link
                  to={application?.status === "approved" ? "/livreur" : "/buyer/profile"}
                  className="inline-block mt-6 bg-afri-primary hover:bg-afri-primary-hover text-white rounded-xl px-6 py-3 font-semibold"
                >
                  {application?.status === "approved" ? "Aller à mon tableau de bord" : "Retour à mon profil"}
                </Link>
              </div>
            </FadeStep>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, placeholder, type = "text", testid, disabled }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="relative mt-1.5">
        {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        <input
          data-testid={testid}
          type={type}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon ? "pl-10" : "pl-3"} pr-3 py-3 rounded-lg border border-gray-300 bg-white text-sm outline-hidden focus:ring-2 focus:ring-afri-primary disabled:bg-gray-50 disabled:text-gray-400`}
        />
      </div>
    </div>
  );
}

function ReviewRow({ label, value, verified }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
        {value}
        {verified && <Check size={13} className="text-afri-primary" />}
      </span>
    </div>
  );
}

function SelfieCapture({ onCaptured, captured, loading, onBack, onNext }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(captured || null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (previewUrl) return;
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch (e) {
        console.warn("Camera access denied or unavailable:", e);
        setCameraError(true);
      }
    }
    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [previewUrl]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    // Mirror horizontally for a natural selfie look
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);

    canvas.toBlob((blob) => {
      if (!blob) { setCapturing(false); return; }
      const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      onCaptured(file);
      setCapturing(false);
    }, "image/jpeg", 0.92);
  };

  const retake = () => {
    setPreviewUrl(null);
    setCameraReady(false);
  };

  return (
    <FadeStep>
      <h2 className="font-display font-bold text-xl text-gray-900">Selfie de vérification</h2>
      <p className="text-sm text-gray-500 mt-1.5">Placez votre visage dans le cadre, bien éclairé, sans lunettes de soleil ni casquette.</p>

      <div className="mt-5 relative rounded-2xl overflow-hidden bg-gray-900 aspect-square">
        {previewUrl ? (
          <img src={previewUrl} alt="Selfie capturé" className="w-full h-full object-cover" data-testid="selfie-preview" />
        ) : cameraError ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white px-6 text-center">
            <Camera size={32} className="text-white/50" />
            <p className="text-sm text-white/80">Caméra indisponible. Autorisez l'accès à la caméra dans les paramètres de votre navigateur, puis réessayez.</p>
            <button
              onClick={() => { setCameraError(false); setCameraReady(false); }}
              className="mt-1 text-xs font-semibold bg-white/15 px-4 py-2 rounded-full"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <Loader2 size={28} className="text-white animate-spin" />
              </div>
            )}
            {cameraReady && (
              <div className="absolute inset-6 border-2 border-white/40 rounded-full pointer-events-none" />
            )}
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-5">
        {previewUrl ? (
          <div className="flex gap-2">
            <button
              data-testid="retake-selfie-btn"
              onClick={retake}
              className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Reprendre
            </button>
            <button
              data-testid="confirm-selfie-btn"
              disabled={loading}
              onClick={onNext}
              className="flex-1 bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-50 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>Continuer <ChevronRight size={18} /></>}
            </button>
          </div>
        ) : (
          <button
            data-testid="capture-selfie-btn"
            disabled={!cameraReady || capturing}
            onClick={capture}
            className="w-full bg-afri-primary hover:bg-afri-primary-hover disabled:opacity-40 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
          >
            {capturing ? <Loader2 size={18} className="animate-spin" /> : <><Camera size={18} /> Prendre la photo</>}
          </button>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={onBack} className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
          <ChevronLeft size={20} />
        </button>
      </div>
    </FadeStep>
  );
}
