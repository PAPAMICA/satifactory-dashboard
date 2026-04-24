import { useQuery } from "@tanstack/react-query";
import { Navigate, type ReactNode } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";

type Me = { isAdmin?: boolean; isPublicViewer?: boolean };

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/api/me"),
  });
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-sf-muted">{t("common.loading")}</p>
      </div>
    );
  }
  if (me?.isPublicViewer || !me?.isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
