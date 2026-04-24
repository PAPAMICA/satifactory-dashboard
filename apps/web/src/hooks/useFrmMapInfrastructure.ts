import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { buildFrmMapOverlays, type FrmMapOverlays } from "@/lib/frmMapOverlays";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";

type InfraKey =
  | "getFactory"
  | "getCables"
  | "getPipes"
  | "getBelts"
  | "getStorageInv"
  | "getGenerators"
  | "getPump"
  | "getExtractor"
  | "getTradingPost"
  | "getHUBTerminal"
  | "getSpaceElevator"
  | "getElevators"
  | "getResourceSinkBuilding"
  | "getRadarTower";

const INFRA_KEYS: InfraKey[] = [
  "getFactory",
  "getCables",
  "getPipes",
  "getBelts",
  "getStorageInv",
  "getGenerators",
  "getPump",
  "getExtractor",
  "getTradingPost",
  "getHUBTerminal",
  "getSpaceElevator",
  "getElevators",
  "getResourceSinkBuilding",
  "getRadarTower",
];

/**
 * Données carte « monde » : réseau + bâtiments + **HUB / ascenseur spatial / ascenseurs / sink / radar**, etc.
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

  const [fac, cab, pip, bel, sto, gen, pump, ext, trade, hub, spaceElev, buildingElevators, sinkB, radar] = results;

  const specialBuildings = useMemo(() => {
    return [
      ...asFrmRowArray(trade.data),
      ...asFrmRowArray(hub.data),
      ...asFrmRowArray(spaceElev.data),
      ...asFrmRowArray(buildingElevators.data),
      ...asFrmRowArray(sinkB.data),
      ...asFrmRowArray(radar.data),
    ];
  }, [trade.data, hub.data, spaceElev.data, buildingElevators.data, sinkB.data, radar.data]);

  const overlays: FrmMapOverlays = useMemo(() => {
    return buildFrmMapOverlays({
      factories: asFrmRowArray(fac.data),
      cables: asFrmRowArray(cab.data),
      pipes: asFrmRowArray(pip.data),
      belts: asFrmRowArray(bel.data),
      storage: asFrmRowArray(sto.data),
      generators: asFrmRowArray(gen.data),
      pumps: asFrmRowArray(pump.data),
      extractors: asFrmRowArray(ext.data),
      specialBuildings,
    });
  }, [fac.data, cab.data, pip.data, bel.data, sto.data, gen.data, pump.data, ext.data, specialBuildings]);

  const overlayCountKey = useMemo(() => {
    const fc = asFrmRowArray(fac.data).length;
    const cc = asFrmRowArray(cab.data).length;
    const pc = asFrmRowArray(pip.data).length;
    const bc = asFrmRowArray(bel.data).length;
    const sc = asFrmRowArray(sto.data).length;
    const gc = asFrmRowArray(gen.data).length;
    const ppc = asFrmRowArray(pump.data).length;
    const ec = asFrmRowArray(ext.data).length;
    const sp = specialBuildings.length;
    return `${fc}:${cc}:${pc}:${bc}:${sc}:${gc}:${ppc}:${ec}:${sp}`;
  }, [fac.data, cab.data, pip.data, bel.data, sto.data, gen.data, pump.data, ext.data, specialBuildings]);

  const isPending = results.some((r) => r.isPending);
  const isError = results.some((r) => r.isError);

  return { overlays, overlayCountKey, isPending, isError };
}
