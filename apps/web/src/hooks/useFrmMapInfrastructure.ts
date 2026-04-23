import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { buildFrmMapOverlays, type FrmMapOverlays } from "@/lib/frmMapOverlays";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";

type InfraKey = "getFactory" | "getCables" | "getPipes" | "getBelts";

const INFRA_KEYS: InfraKey[] = ["getFactory", "getCables", "getPipes", "getBelts"];

/**
 * Données carte « monde » (usines, câbles, tuyaux, convoyeurs) — mêmes endpoints que FRM.
 * React Query déduplique avec le reste de l’app (clés identiques).
 *
 * `overlayCountKey` ne change que si le **nombre** d’entités change (pas à chaque refetch) :
 * évite de recadrer la vue à chaque poll.
 */
export function useFrmMapInfrastructure(enabled: boolean, refetchMs: number | false) {
  const results = useQueries({
    queries: INFRA_KEYS.map((key) => ({
      queryKey: ["frm", key],
      queryFn: () => apiFetch<unknown>(frmGetUrl(key)),
      refetchInterval: refetchMs,
      enabled: enabled && refetchMs !== false,
    })),
  });

  const [fac, cab, pip, bel] = results;

  const overlays: FrmMapOverlays = useMemo(() => {
    return buildFrmMapOverlays({
      factories: asFrmRowArray(fac.data),
      cables: asFrmRowArray(cab.data),
      pipes: asFrmRowArray(pip.data),
      belts: asFrmRowArray(bel.data),
    });
  }, [fac.data, cab.data, pip.data, bel.data]);

  const overlayCountKey = useMemo(() => {
    const fc = asFrmRowArray(fac.data).length;
    const cc = asFrmRowArray(cab.data).length;
    const pc = asFrmRowArray(pip.data).length;
    const bc = asFrmRowArray(bel.data).length;
    return `${fc}:${cc}:${pc}:${bc}`;
  }, [fac.data, cab.data, pip.data, bel.data]);

  const isPending = results.some((r) => r.isPending);
  const isError = results.some((r) => r.isError);

  return { overlays, overlayCountKey, isPending, isError };
}
