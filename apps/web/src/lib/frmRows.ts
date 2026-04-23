/** Réponses FRM : tableau d’objets ou vide. */
export function asFrmRowArray(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}
