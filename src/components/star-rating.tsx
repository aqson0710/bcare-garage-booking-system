"use client";

const ratingLabels = ["", "แย่", "พอใช้", "ปานกลาง", "ดี", "ดีมาก"];

function StarIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      height={size}
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M12 2.8l2.84 5.75 6.35.92-4.6 4.48 1.09 6.32L12 17.29l-5.68 2.98 1.09-6.32-4.6-4.48 6.35-.92L12 2.8z" />
    </svg>
  );
}

// Read-only stars, e.g. "★★★★☆ 4.2 (12 รีวิว)".
export function StarRatingDisplay({
  count,
  rating,
  size = 16,
}: {
  count?: number;
  rating: number;
  size?: number;
}) {
  const rounded = Math.round(rating);

  return (
    <span
      aria-label={`คะแนน ${rating.toFixed(1)} จาก 5`}
      className="inline-flex items-center gap-1.5"
    >
      <span className="inline-flex text-[var(--brand)]">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon filled={star <= rounded} key={star} size={size} />
        ))}
      </span>
      <span className="text-sm font-semibold text-[var(--foreground)]">
        {rating.toFixed(1)}
      </span>
      {count !== undefined ? (
        <span className="text-xs text-[var(--muted)]">({count} รีวิว)</span>
      ) : null}
    </span>
  );
}

// Clickable 1-5 stars. A radio group, so it also works with the keyboard
// (Tab to focus, arrow keys to change) and screen readers.
export function StarRatingInput({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (rating: number) => void;
  value: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        aria-label="ให้คะแนน"
        className="inline-flex gap-1"
        role="radiogroup"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            aria-checked={value === star}
            aria-label={`${star} ดาว - ${ratingLabels[star]}`}
            className="rounded-md p-1 text-[var(--brand)] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            key={star}
            onClick={() => onChange(star)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                event.preventDefault();
                onChange(Math.min(5, (value || 0) + 1));
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                event.preventDefault();
                onChange(Math.max(1, (value || 2) - 1));
              }
            }}
            role="radio"
            tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
            type="button"
          >
            <StarIcon filled={star <= value} size={32} />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-[var(--muted)]">
        {value ? ratingLabels[value] : "แตะดาวเพื่อให้คะแนน"}
      </span>
    </div>
  );
}
