// Slow, low-opacity diagonal waves used as a decorative backdrop accent.
// Originally built for the auth screens (see AuthShell in
// auth-panel.tsx) and pulled out here so the homepage can reuse the same
// visual motif instead of re-implementing it. Purely decorative: wrap it
// in an `aria-hidden`/`pointer-events-none` ancestor with `overflow-hidden`
// (both auth-panel.tsx and home-panel.tsx already do this for their own
// backdrop layer) - this component only renders the tilted, oversized
// wave strips themselves, not that wrapper, since callers usually need to
// stack other backdrop layers (gradients, glow blobs) alongside it.
//
// Movement is a single CSS keyframe (`bcare-wave-drift` in globals.css)
// applied via the `.bcare-wave` class; each `<svg>` just sets its own
// animation-duration/direction inline. `.bcare-wave` turns itself off for
// prefers-reduced-motion, so this needs no extra handling here.
export function DiagonalWaves({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute left-1/2 top-1/2 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2 rotate-[-16deg] ${className}`.trim()}
    >
      <svg
        className="bcare-wave absolute left-0 top-[40%] h-40 w-full sm:h-56"
        preserveAspectRatio="none"
        style={{ animationDuration: "48s" }}
        viewBox="0 0 2400 300"
      >
        <path
          d="M0,150 C150,80 450,220 600,150 C750,80 1050,220 1200,150 C1350,80 1650,220 1800,150 C1950,80 2250,220 2400,150 L2400,300 L0,300 Z"
          fill="var(--accent-soft)"
          fillOpacity="0.55"
        />
      </svg>
      <svg
        className="bcare-wave absolute left-0 top-[58%] h-40 w-full sm:h-56"
        preserveAspectRatio="none"
        style={{ animationDirection: "reverse", animationDuration: "34s" }}
        viewBox="0 0 2400 300"
      >
        <path
          d="M0,190 C200,130 400,250 600,190 C800,130 1000,250 1200,190 C1400,130 1600,250 1800,190 C2000,130 2200,250 2400,190 L2400,300 L0,300 Z"
          fill="var(--brand-strong)"
          fillOpacity="0.35"
        />
      </svg>
    </div>
  );
}
