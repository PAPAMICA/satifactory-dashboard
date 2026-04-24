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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 sm:gap-4">
      <div className="shrink-0">
        <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl">
          {t("monitoring.mapTitle")}
        </h1>
        <p className="mt-1 text-xs text-sf-muted sm:text-sm">{t("monitoring.mapHint")}</p>
      </div>
      <div className="sf-panel flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
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
  );
}

export function MapPage() {
  return (
    <MonitoringGate>
      <MapPageBody />
    </MonitoringGate>
  );
}
