import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import api, { formatApiError } from "../lib/api";

export default function ReviewPrompt({ orderId, sellerName, onSubmitted }) {
  const [canReview, setCanReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    api.get(`/reviews/can-review/${orderId}`).then(({ data }) => {
      setCanReview(data.can_review);
      if (data.review) setExisting(data.review);
    });
  }, [orderId]);

  if (existing) {
    return (
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" data-testid="review-already">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Votre avis</h3>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((n) => (
            <Star key={n} size={18} className={n <= existing.rating ? "text-[#EF9F27] fill-[#EF9F27]" : "text-gray-200"} />
          ))}
        </div>
        {existing.comment && <p className="text-sm text-gray-700 mt-2">{existing.comment}</p>}
      </section>
    );
  }

  if (!canReview) return null;

  const submit = async () => {
    if (rating === 0) {
      toast.error("Choisissez une note");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/reviews", { order_id: orderId, rating, comment });
      toast.success("Merci pour votre avis !");
      onSubmitted?.();
      const { data } = await api.get(`/reviews/can-review/${orderId}`);
      if (data.review) setExisting(data.review);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border-2 border-[#EF9F27]/40 shadow-sm p-4" data-testid="review-prompt">
      <h3 className="font-display font-bold text-base text-gray-900">Notez {sellerName}</h3>
      <p className="text-xs text-gray-500 mt-0.5">Votre avis aide les autres acheteurs.</p>
      <div className="flex gap-1 mt-3" onMouseLeave={() => setHover(0)}>
        {[1,2,3,4,5].map((n) => (
          <button
            key={n}
            data-testid={`star-${n}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className="p-1"
          >
            <Star size={28} className={(hover || rating) >= n ? "text-[#EF9F27] fill-[#EF9F27]" : "text-gray-300"} />
          </button>
        ))}
      </div>
      <textarea
        data-testid="review-comment-input"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Décrivez votre expérience (optionnel)…"
        rows={2}
        className="w-full mt-3 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
      />
      <button
        data-testid="submit-review-btn"
        disabled={submitting}
        onClick={submit}
        className="w-full mt-3 bg-[#1D9E75] hover:bg-[#168260] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? "Envoi…" : "Envoyer mon avis"}
      </button>
    </section>
  );
}
