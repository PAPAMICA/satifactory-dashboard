import { useId, useMemo } from "react";

const TAU = 2 * Math.PI;

export type FractionDonutVariant = "default" | "production" | "consumption";

const VARIANT_STOPS: Record<FractionDonutVariant, [string, string]> = {
  default: ["#fb923c", "#5fd4ff"],
  production: ["#86efac", "#fb923c"],
  consumption: ["#fb923c", "#5fd4ff"],
};

/**
 * Anneau de progression 0–1 (affichage « donut ») pour parts / charges dans toute l’app.
 */
export function FractionDonut({
  fraction,
  size = 40,
  strokeWidth,
  variant = "default",
  showCenterLabel = true,
  className = "",
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  variant?: FractionDonutVariant;
  /** Afficher le pourcentage au centre (désactiver si très petit). */
  showCenterLabel?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gid = `fdg-${uid}`;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const pct = Math.round(clamped * 100);
  const vb = size;
  const c = vb / 2;
  const sw = strokeWidth ?? Math.max(2.25, size * 0.09);
  const r = Math.max(3.5, (vb - sw) / 2 - 0.5);
  const circ = TAU * r;
  const dash = circ * clamped;
  const gap = circ - dash;
  const [c0, c1] = VARIANT_STOPS[variant];

  const fontPx = useMemo(() => Math.max(0.55 * size, 9), [size]);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} className="block overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c0} />
            <stop offset="100%" stopColor={c1} />
          </linearGradient>
        </defs>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={sw}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={sw}
          strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
          strokeDasharray={`${dash} ${gap}`}
        />
      </svg>
      {showCenterLabel && size >= 26 ?
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono font-semibold tabular-nums text-sf-cream"
          style={{ fontSize: `${fontPx}px` }}
        >
          {pct}%
        </span>
      : null}
    </div>
  );
}
