/** Groupe les milliers avec un espace (ex. 10 000). */
export function formatIntegerSpaces(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.trunc(n));
  return sign + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Nombre décimal : partie entière groupée, séparateur décimal « . ». */
export function formatDecimalSpaces(n: number, fractionDigits: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const fixed = abs.toFixed(fractionDigits);
  const [intRaw, frac] = fixed.split(".");
  const intGrouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return sign + intGrouped + (frac != null && frac.length ? `.${frac}` : "");
}
