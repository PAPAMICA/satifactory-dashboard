import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { apiFetch } from "@/lib/api";

type Settings = { frmTokenConfigured: boolean };

export function MonitoringGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data: s, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/api/settings"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <FicsitPageLoader density="compact" className="min-h-52 flex-1 border-0 bg-transparent" />
      </div>
    );
  }

  if (!s?.frmTokenConfigured) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-center space-y-3">
        <div className="sf-panel border-sf-orange/40 p-4 text-sm text-sf-muted">
          <p>{t("monitoring.frmNotConfigured")}</p>
          <Link to="/settings" className="mt-2 inline-block text-sf-orange underline-offset-2 hover:underline">
            {t("monitoring.openSettings")}
          </Link>
        </div>
      </div>
    );
  }

  return <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>;
}
