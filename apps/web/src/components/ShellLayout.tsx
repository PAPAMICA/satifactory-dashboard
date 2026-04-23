import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type Me = { username: string; isAdmin: boolean; isPublicViewer?: boolean };

const SIDEBAR_COLLAPSED_KEY = "sf_sidebar_collapsed";

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
      <rect x="3" y="15" width="7" height="6" rx="1" />
    </svg>
  );
}

function IconInventory({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

function IconPower({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconMap({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function IconDrone({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 12v.01" />
      <path d="M14.5 9.5a2.5 2.5 0 0 0-5 0v5a2.5 2.5 0 0 0 5 0v-5Z" />
      <path d="M9 12H4.5a2.5 2.5 0 0 1 0-5H9" />
      <path d="M15 12h4.5a2.5 2.5 0 0 0 0-5H15" />
      <path d="M9 12H4.5a2.5 2.5 0 0 0 0 5H9" />
      <path d="M15 12h4.5a2.5 2.5 0 0 1 0 5H15" />
    </svg>
  );
}

function IconSink({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconSession({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconFactory({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M2 20h20" />
      <path d="M4 20V10l4 3 4-3v10" />
      <path d="M14 20v-6h6v6" />
      <path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconAdmin({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function LangToggle({
  lang,
  onLang,
  t,
  compact,
}: {
  lang: string;
  onLang: (lng: string) => void;
  t: (k: string) => string;
  compact?: boolean;
}) {
  const isFr = lang.startsWith("fr");
  const isEn = !isFr;
  const inner = compact ? "flex flex-col items-center gap-0" : "flex flex-row items-center gap-1";
  const seg =
    "flex flex-1 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sf-orange " +
    (compact ? "min-h-[2.35rem] px-0.5 py-0.5" : "min-h-[2.25rem] px-2 py-1.5");
  const on = "bg-sf-orange/20 text-sf-orange ring-1 ring-sf-orange/40";
  const off = "text-sf-muted ring-1 ring-transparent hover:bg-white/5 hover:text-sf-text";
  const lbl = "text-[0.58rem] font-bold uppercase tracking-[0.1em]";
  const flag = compact ? "text-[0.95rem] leading-none" : "text-[1.05rem] leading-none";
  return (
    <div
      className={
        compact ?
          "flex w-full min-w-0 flex-col gap-0.5 rounded-lg border border-sf-border/70 bg-black/35 p-0.5"
        : "flex w-full min-w-0 flex-row gap-0.5 rounded-lg border border-sf-border/70 bg-black/35 p-0.5"
      }
      role="group"
      aria-label={t("nav.language")}
    >
      <button
        type="button"
        className={`${seg} ${inner} ${isEn ? on : off}`}
        onClick={() => onLang("en")}
        aria-pressed={isEn}
        aria-label={t("nav.langEnglish")}
      >
        <span className={flag} aria-hidden>
          🇬🇧
        </span>
        <span className={lbl}>EN</span>
      </button>
      <button
        type="button"
        className={`${seg} ${inner} ${isFr ? on : off}`}
        onClick={() => onLang("fr")}
        aria-pressed={isFr}
        aria-label={t("nav.langFrench")}
      >
        <span className={flag} aria-hidden>
          🇫🇷
        </span>
        <span className={lbl}>FR</span>
      </button>
    </div>
  );
}

function ShellAccountLangLogout({
  me,
  lang,
  onLang,
  onLogout,
  t,
  navCollapsed,
  variant,
  compactDockRow,
}: {
  me: Me | undefined;
  lang: string;
  onLang: (lng: string) => void;
  onLogout: () => void;
  t: (k: string) => string;
  navCollapsed: boolean;
  variant: "dock" | "drawer";
  /** Barre inférieure pleine largeur (mobile) : une ligne horizontale. */
  compactDockRow?: boolean;
}) {
  const logoutBtn =
    "flex min-h-10 shrink-0 items-center gap-2 rounded-lg text-sm font-medium text-sf-muted transition-colors hover:bg-white/5 hover:text-sf-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sf-orange " +
    (navCollapsed || compactDockRow ? "justify-center px-0" : "w-full justify-center px-3 md:justify-start");
  if (compactDockRow) {
    return (
      <div className="flex w-full min-w-0 flex-row items-center gap-2">
        {me ?
          <p className="min-w-0 flex-1 truncate text-left text-[0.7rem] leading-tight text-sf-muted" title={me.username}>
            {me.isPublicViewer ? t("nav.publicViewerUser") : me.username}
          </p>
        : (
          <span className="min-w-0 flex-1 text-[0.7rem] text-sf-muted">—</span>
        )}
        <div className="w-[6.5rem] shrink-0">
          <LangToggle lang={lang} onLang={onLang} t={t} compact={false} />
        </div>
        <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-sf-muted hover:bg-white/5 hover:text-sf-orange"
          onClick={onLogout}
          aria-label={t("nav.logout")}
          title={t("nav.logout")}
        >
          <IconLogout className="shrink-0" />
        </button>
      </div>
    );
  }
  return (
    <div className={variant === "dock" ? "flex w-full min-w-0 flex-col gap-2" : "flex w-full flex-col gap-2"}>
      {me && !navCollapsed ?
        <p
          className="truncate px-0.5 text-center text-[0.7rem] leading-tight text-sf-muted md:text-left md:text-xs"
          title={me.username}
        >
          {me.isPublicViewer ? t("nav.publicViewerUser") : me.username}
        </p>
      : null}
      {me && navCollapsed ?
        <p
          className="truncate text-center text-[0.65rem] leading-tight text-sf-muted"
          title={me.isPublicViewer ? t("nav.publicViewerUser") : me.username}
        >
          {me.isPublicViewer ? "@" : me.username.slice(0, 2)}
        </p>
      : null}
      <div className={navCollapsed ? "flex w-full justify-center" : "w-full"}>
        <LangToggle lang={lang} onLang={onLang} t={t} compact={navCollapsed} />
      </div>
      <button type="button" className={logoutBtn} onClick={onLogout} title={navCollapsed ? t("nav.logout") : undefined}>
        <IconLogout className="shrink-0" />
        {!navCollapsed ? <span className="truncate uppercase tracking-wider">{t("nav.logout")}</span> : null}
      </button>
    </div>
  );
}

type NavTone = "default" | "admin";

function sidebarLinkClass({ isActive }: { isActive: boolean }, tone: NavTone, collapsed: boolean) {
  const base =
    "flex min-h-11 items-center gap-3 rounded-lg text-sm font-medium transition-colors md:min-h-10 " +
    (collapsed ? "justify-center px-0 md:px-0" : "px-3");
  if (tone === "admin") {
    return `${base} ${
      isActive ? "bg-sf-cyan/15 text-sf-cyan" : "text-sf-muted hover:bg-white/5 hover:text-sf-text"
    }`;
  }
  return `${base} ${
    isActive ? "bg-sf-orange/20 text-sf-orange" : "text-sf-muted hover:bg-white/5 hover:text-sf-text"
  }`;
}

function SidebarNavLink({
  to,
  end,
  icon,
  label,
  collapsed,
  tone = "default",
  onNavigate,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  tone?: NavTone;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={(p) => sidebarLinkClass(p, tone, collapsed)}
    >
      <span className="shrink-0 opacity-90">{icon}</span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate uppercase tracking-wider">{label}</span> : null}
    </NavLink>
  );
}

export function ShellLayout({
  children,
  lang,
  onLang,
  onLogout,
}: {
  children: React.ReactNode;
  lang: string;
  onLang: (lng: string) => void;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/api/me"),
  });

  const isMdUp = useMediaQuery("(min-width: 768px)");

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);
  /** Replié = icônes seules ; uniquement à partir de `md` (sur mobile le tiroir reste étiqueté). */
  const navCollapsed = isMdUp && collapsed;
  const asideWidthClass = navCollapsed ? "w-52 md:w-14" : "w-52 md:w-52";

  const sidebarInner = (
    <>
      <div
        className={
          "flex h-14 shrink-0 items-center border-b border-sf-border/60 px-2 " +
          (navCollapsed ? "justify-center md:justify-center" : "gap-2 px-3")
        }
      >
        <span
          className={
            "sf-brand truncate text-center font-semibold uppercase tracking-[0.12em] text-sf-orange " +
            (navCollapsed ? "text-[0.6rem] leading-tight md:text-[0.6rem]" : "text-xs sm:text-sm")
          }
          title={t("appTitle")}
        >
          {navCollapsed ? "FICSIT" : t("appTitle")}
        </span>
      </div>

      <nav
        className={
          "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2 pb-2 " +
          (navCollapsed ? "md:pb-[11.5rem]" : "md:pb-[14rem]")
        }
        aria-label={t("nav.menu")}
      >
        <SidebarNavLink
          to="/"
          end
          icon={<IconDashboard className="shrink-0" />}
          label={t("nav.dashboard")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        <SidebarNavLink
          to="/inventory"
          icon={<IconInventory className="shrink-0" />}
          label={t("nav.inventory")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        <SidebarNavLink
          to="/power"
          icon={<IconPower className="shrink-0" />}
          label={t("nav.monPower")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        <SidebarNavLink
          to="/map"
          icon={<IconMap className="shrink-0" />}
          label={t("nav.monMap")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        <SidebarNavLink
          to="/drone"
          icon={<IconDrone className="shrink-0" />}
          label={t("nav.monDrones")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        <SidebarNavLink
          to="/resourcesink"
          icon={<IconSink className="shrink-0" />}
          label={t("nav.monSink")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        <SidebarNavLink
          to="/session"
          icon={<IconSession className="shrink-0" />}
          label={t("nav.monSession")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        <SidebarNavLink
          to="/production"
          icon={<IconFactory className="shrink-0" />}
          label={t("nav.monFactory")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        <SidebarNavLink
          to="/settings"
          icon={<IconSettings className="shrink-0" />}
          label={t("nav.settings")}
          collapsed={navCollapsed}
          onNavigate={closeMobile}
        />
        {me?.isAdmin ? (
          <SidebarNavLink
            to="/admin"
            icon={<IconAdmin className="shrink-0" />}
            label={t("nav.admin")}
            collapsed={navCollapsed}
            tone="admin"
            onNavigate={closeMobile}
          />
        ) : null}
      </nav>

      {mobileOpen ? (
        <div className="shrink-0 border-t border-sf-border/60 bg-[#12100e] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          <ShellAccountLangLogout
            variant="drawer"
            me={me}
            lang={lang}
            onLang={onLang}
            onLogout={() => {
              closeMobile();
              onLogout();
            }}
            t={t}
            navCollapsed={false}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-[100dvh] items-stretch">
      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label={t("nav.closeMenu")}
          onClick={closeMobile}
        />
      ) : null}

      {/* Sidebar : tiroir mobile ; md = rail sticky hauteur viewport (barre d’actions en fixed en bas d’écran) */}
      <aside
        className={
          "relative flex shrink-0 flex-col border-r border-sf-border/80 bg-[#12100e] shadow-xl transition-[transform,width] duration-200 ease-out " +
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:h-full " +
          "md:sticky md:top-0 md:z-10 md:h-[100dvh] md:self-start md:shadow-none " +
          asideWidthClass +
          (mobileOpen ? " translate-x-0" : " -translate-x-full md:translate-x-0")
        }
      >
        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
          {sidebarInner}
        </div>
      </aside>

      {/* Réduire + compte + langue + déconnexion : toujours fixés au bas du viewport (largeur = rail sur md+) */}
      <div
        className={
          "fixed bottom-0 left-0 z-[42] flex flex-col gap-2 border-t border-sf-border/90 bg-[#12100e] px-3 py-2 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md " +
          "pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] max-md:right-0 " +
          (navCollapsed ? "md:w-14 md:px-1.5" : "md:w-52 md:px-3") +
          " md:right-auto " +
          "transition-[width,padding] duration-200 ease-out " +
          (mobileOpen ? "hidden md:flex" : "flex")
        }
      >
        {isMdUp ?
          <button
            type="button"
            className={
              "flex w-full min-h-10 items-center gap-2 rounded-lg border border-sf-border/50 text-sf-muted transition-colors hover:border-sf-orange/40 hover:text-sf-text " +
              (navCollapsed ? "justify-center px-0" : "px-3")
            }
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("nav.sidebarExpand") : t("nav.sidebarCollapse")}
            title={collapsed ? t("nav.sidebarExpand") : t("nav.sidebarCollapse")}
          >
            {collapsed ? <IconChevronRight className="shrink-0" /> : <IconChevronLeft className="shrink-0" />}
            {!collapsed ? (
              <span className="truncate text-xs uppercase tracking-wider">{t("nav.sidebarCollapse")}</span>
            ) : null}
          </button>
        : null}
        <ShellAccountLangLogout
          variant="dock"
          me={me}
          lang={lang}
          onLang={onLang}
          onLogout={onLogout}
          t={t}
          navCollapsed={isMdUp ? navCollapsed : false}
          compactDockRow={!isMdUp && !mobileOpen}
        />
      </div>

      {/* Zone principale */}
      <div className="flex min-h-[100dvh] w-full min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-sf-border/60 bg-[#12100e]/95 px-2 py-2 backdrop-blur-sm md:hidden">
          <button
            type="button"
            className="sf-btn inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center px-0"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.menu")}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <span className="text-lg">✕</span> : <IconMenu />}
          </button>
          <span className="sf-brand min-w-0 truncate text-xs uppercase tracking-[0.12em] text-sf-orange">{t("appTitle")}</span>
        </header>

        <main
          className={
            "relative flex min-h-0 w-full min-w-0 flex-1 flex-col px-2 pt-3 sm:px-4 sm:pt-4 sf-grid-bg " +
            (!mobileOpen ?
              "max-md:pb-[calc(4.25rem+max(0.75rem,env(safe-area-inset-bottom,0px)))] md:pb-4"
            : "max-md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:pb-4")
          }
        >
          {me?.isPublicViewer ?
            <div
              className="mb-3 shrink-0 rounded border border-sf-cyan/35 bg-sf-cyan/10 px-3 py-2 text-center text-[0.7rem] leading-snug text-sf-cyan sm:text-xs"
              role="status"
            >
              {t("nav.publicViewerBanner")}
            </div>
          : null}
          {children}
        </main>
      </div>
    </div>
  );
}
