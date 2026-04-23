import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type Settings = {
  frmTokenConfigured: boolean;
  pollIntervalMs: number;
};

/**
 * Intervalle de refetch React Query aligné sur les paramètres FRM.
 * `false` si FRM non configuré (pas de polling inutile).
 */
export function useFrmRefetchMs(): number | false {
  const { data: s } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/api/settings"),
  });
  if (!s?.frmTokenConfigured) return false;
  const ms = Number(s.pollIntervalMs) || 10_000;
  return Math.min(120_000, Math.max(2000, ms));
}
