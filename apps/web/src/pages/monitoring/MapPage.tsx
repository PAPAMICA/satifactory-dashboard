import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { FrmWorldMapPage } from "@/components/FrmWorldMapPage";
import { MonitoringGate } from "@/components/MonitoringGate";
import { useFrmRefetchMs } from "@/hooks/useFrmRefetchMs";
import { asFrmRowArray } from "@/lib/frmRows";
import { frmGetUrl } from "@/lib/frmApi";

function MapPageBody() {
  const { t } = useTranslation();
  const refetchMs = useFrmRefetchMs();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ isAdmin?: boolean }>("/api/me"),
    staleTime: 60_000,
  });
  const q = useQuery({
    queryKey: ["frm", "getMapMarkers"],
    queryFn: () => apiFetch<unknown>(frmGetUrl("getMapMarkers")),
    refetchInterval: refetchMs,
  });
  const rows = asFrmRowArray(q.data);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="sf-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="sf-panel-header flex flex-wrap items-center justify-between gap-2 py-2">
          <h1 className="sf-display text-base font-semibold uppercase tracking-[0.12em] sm:text-lg">
            {t("monitoring.mapTitle")}
          </h1>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
          {q.isError ? (
            <p className="text-sm text-sf-orange">{(q.error as Error).message}</p>
          ) : q.isPending ? (
            <FicsitPageLoader className="min-h-0 flex-1 border-0 bg-transparent" />
          ) : (
            <FrmWorldMapPage
              markers={rows}
              scrollWheelZoom
              isAdmin={Boolean(me?.isAdmin)}
              className="min-h-0 flex-1"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function MapPage() {
  return (
    <MonitoringGate>
      <MapPageBody />
    </MonitoringGate>
  );
}
