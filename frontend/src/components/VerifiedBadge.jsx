import { ShieldCheck } from "lucide-react";

export default function VerifiedBadge({ size = "sm" }) {
  const cls =
    size === "lg"
      ? "text-xs px-2.5 py-1"
      : "text-[10px] px-2 py-0.5";
  return (
    <span
      data-testid="verified-badge"
      className={`inline-flex items-center gap-1 rounded-full bg-[#E1F5EE] text-[#1D9E75] font-bold uppercase tracking-wide ${cls}`}
    >
      <ShieldCheck size={size === "lg" ? 14 : 11} />
      Vérifié
    </span>
  );
}
