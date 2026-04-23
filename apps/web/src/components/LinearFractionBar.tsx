/** Barre de progression 0–1 (usage monitoring / sinks / énergie). */
export function LinearFractionBar({ fraction }: { fraction: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <div
      className="w-full min-w-0 max-w-full"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-1 w-full min-w-0 overflow-hidden rounded-full bg-black/45 ring-1 ring-sf-border/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sf-orange/90 to-sf-cyan/80 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
