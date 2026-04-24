import { type ReactNode, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AdminPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { DronesPage } from "./pages/monitoring/DronesPage";
import { MapPage } from "./pages/monitoring/MapPage";
import { ControlPage } from "./pages/monitoring/ControlPage";
import { PowerPage } from "./pages/monitoring/PowerPage";
import { ProductionPage } from "./pages/monitoring/ProductionPage";
import { ResourceSinkPage } from "./pages/monitoring/ResourceSinkPage";
import { SessionMonitorPage } from "./pages/monitoring/SessionMonitorPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import { FicsitPageLoader } from "./components/FicsitPageLoader";
import { RequireAdmin } from "./components/RequireAdmin";
import { BuildingDetailModalProvider } from "./contexts/BuildingDetailModalContext";
import { ShellLayout } from "./components/ShellLayout";
import { apiFetch } from "./lib/api";
import { clearAllAuth, isLoggedIn } from "./lib/auth";
import { setLanguage } from "./i18n";

type MeDto = { isPublicViewer?: boolean };

function RequireNonPublic({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeDto>("/api/me"),
  });
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-sf-muted">{t("common.loading")}</p>
      </div>
    );
  }
  if (me?.isPublicViewer) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { i18n } = useTranslation();
  const [init, setInit] = useState<"loading" | "setup" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await apiFetch<{ needsSetup: boolean }>("/api/init-status");
        if (cancelled) return;
        setInit(s.needsSetup ? "setup" : "ready");
      } catch {
        if (!cancelled) setInit("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (init === "loading") {
    return <FicsitPageLoader variant="fullscreen" />;
  }

  if (init === "setup") {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage onDone={() => setInit("ready")} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  if (!isLoggedIn()) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <ShellLayout
      lang={i18n.language}
      onLang={(lng) => setLanguage(lng)}
      onLogout={() => {
        clearAllAuth();
        window.location.href = "/login";
      }}
    >
      <BuildingDetailModalProvider>
        <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/power" element={<PowerPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/drone" element={<DronesPage />} />
        <Route path="/resourcesink" element={<ResourceSinkPage />} />
        <Route path="/session" element={<SessionMonitorPage />} />
        <Route path="/production" element={<ProductionPage />} />
        <Route
          path="/control"
          element={
            <RequireAdmin>
              <ControlPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireNonPublic>
              <SettingsPage />
            </RequireNonPublic>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireNonPublic>
              <AdminPage />
            </RequireNonPublic>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BuildingDetailModalProvider>
    </ShellLayout>
  );
}
