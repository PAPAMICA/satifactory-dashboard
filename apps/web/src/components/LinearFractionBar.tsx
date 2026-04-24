/** Barre horizontale 0–1 (répartition charge / progression). */
export function LinearFractionBar({
  fraction,
  className = "",
  kind = "default",
}: {
  fraction: number;
  className?: string;
  kind?: "default" | "production" | "consumption";
}) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  const grad =
    kind === "production" ? "from-sf-ok/90 to-sf-orange/75"
    : kind === "consumption" ? "from-sf-orange/90 to-sf-cyan/80"
    : "from-sf-orange/90 to-sf-cyan/80";
  return (
    <div
      className={`w-full min-w-0 max-w-full ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-1 w-full min-w-0  rounded-full bg-black/45 ring-1 ring-sf-border/40">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${grad} transition-[width] duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
