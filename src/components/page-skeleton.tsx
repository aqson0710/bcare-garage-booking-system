// Grey placeholder blocks shown while a page loads, shaped like the content
// that is about to appear (a card grid, a list, or a detail/form page), so
// the layout doesn't jump when data arrives. The label is read by screen
// readers; the pulse animation is skipped for users who prefer reduced motion.

type PageSkeletonVariant = "cards" | "detail" | "list";

function Block({ className }: { className: string }) {
  return (
    <div
      className={`rounded-md bg-[var(--surface-muted)] motion-safe:animate-pulse ${className}`}
    />
  );
}

export function PageSkeleton({
  label,
  rows = 5,
  variant = "list",
  withStats = true,
}: {
  label: string;
  // Number of rows in the "list" variant.
  rows?: number;
  variant?: PageSkeletonVariant;
  // "list" variant: show the row of summary tiles above the list.
  withStats?: boolean;
}) {
  return (
    <section aria-busy="true" aria-live="polite" className="py-6">
      <span className="sr-only">{label}</span>

      {variant === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]"
              key={index}
            >
              <Block className="h-40 rounded-none" />
              <div className="space-y-3 p-5">
                <Block className="h-5 w-3/4" />
                <Block className="h-4 w-full" />
                <Block className="h-4 w-2/3" />
                <Block className="mt-4 h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {variant === "list" ? (
        <div className="space-y-3">
          {withStats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Block className="h-20" key={index} />
              ))}
            </div>
          ) : null}
          {Array.from({ length: rows }, (_, index) => (
            <div
              className="flex items-center gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
              key={index}
            >
              <Block className="h-6 w-16 shrink-0" />
              <div className="flex-1 space-y-2">
                <Block className="h-4 w-1/2" />
                <Block className="h-3 w-1/3" />
              </div>
              <Block className="hidden h-10 w-28 shrink-0 sm:block" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "detail" ? (
        <div className="space-y-5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
          <Block className="h-4 w-32" />
          <Block className="h-8 w-2/3" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="space-y-2" key={index}>
                <Block className="h-3 w-24" />
                <Block className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Block className="h-10 w-40" />
        </div>
      ) : null}
    </section>
  );
}
