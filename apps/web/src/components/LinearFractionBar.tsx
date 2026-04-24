import { FractionDonut } from "@/components/FractionDonut";

/** @deprecated Nom historique : rendu en donut (anneau 0–1). */
export function LinearFractionBar({
  fraction,
  size = 40,
  variant = "default",
}: {
  fraction: number;
  size?: number;
  variant?: "default" | "production" | "consumption";
}) {
  return (
    <div className="flex w-full min-w-0 justify-center py-0.5">
      <FractionDonut fraction={fraction} size={size} variant={variant} showCenterLabel={size >= 26} />
    </div>
  );
}
