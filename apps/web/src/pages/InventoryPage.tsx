import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { IconBookWiki, IconHeart, IconLayers, IconSearch, IconTrendUp } from "@/components/InventoryIcons";
import { ItemThumb } from "@/components/ItemThumb";
import { useMergedInventoryItems } from "@/hooks/useMergedInventoryItems";
import { apiFetch } from "@/lib/api";
import { formatDecimalSpaces, formatIntegerSpaces } from "@/lib/formatNumber";
import { wikiItemDetailUrl } from "@/lib/itemCatalog";
import { itemDisplayName, type InventoryItemRow } from "@/lib/items";

type Settings = { frmTokenConfigured: boolean; pollIntervalMs: number };

type MeDto = { isPublicViewer?: boolean };

function formatRate(r: number | undefined): string {
  if (r === undefined) return "—";
  if (r > 0) return `+${formatDecimalSpaces(r, 1)}`;
  return "0";
}

export function InventoryPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const didFocusSearch = useRef(false);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<Settings>("/api/settings"),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeDto>("/api/me"),
    staleTime: 60_000,
  });
  const readOnlyInv = Boolean(me?.isPublicViewer);

  const pollMs = Math.min(120_000, Math.max(2000, settings?.pollIntervalMs ?? 10_000));
  const frmEnabled = Boolean(settings?.frmTokenConfigured);

  const { data: favoritesData } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => apiFetch<{ favorites: string[] }>("/api/favorites"),
    enabled: frmEnabled,
    staleTime: 30_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: () => apiFetch<{ items: InventoryItemRow[] }>("/api/inventory/summary"),
    refetchInterval: pollMs,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: frmEnabled,
  });

  const { data: ratesData } = useQuery({
    queryKey: ["inventory", "rates"],
    queryFn: () => apiFetch<{ rates: Record<string, number> }>("/api/inventory/rates"),
    refetchInterval: pollMs,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: frmEnabled,
  });

  const mergedItems = useMergedInventoryItems(data?.items, favoritesData?.favorites, i18n.language);
  const rates = ratesData?.rates ?? {};

  useEffect(() => {
    if (settingsLoading || isLoading || error || !frmEnabled) return;
    if (!mergedItems.length || didFocusSearch.current) return;
    didFocusSearch.current = true;
    queueMicrotask(() => {
      searchRef.current?.focus();
    });
  }, [error, frmEnabled, isLoading, mergedItems.length, settingsLoading]);

  const toggle = useMutation({
    mutationFn: async ({ className, on }: { className: string; on: boolean }) => {
      if (readOnlyInv) return;
      const enc = encodeURIComponent(className);
      if (on) {
        await apiFetch(`/api/favorites/${enc}`, { method: "POST" });
      } else {
        await apiFetch(`/api/favorites/${enc}`, { method: "DELETE" });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory", "summary"] });
      void qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return mergedItems;
    return mergedItems.filter((i) => {
      const dn = itemDisplayName(i, i18n.language).toLowerCase();
      return dn.includes(s) || i.name.toLowerCase().includes(s) || i.className.toLowerCase().includes(s);
    });
  }, [mergedItems, q, i18n.language]);

  if (settingsLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <FicsitPageLoader className="min-h-0 flex-1 border-0 bg-transparent" />
      </div>
    );
  }

  if (!settings?.frmTokenConfigured) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="w-full min-w-0 sf-panel p-4 text-sm text-sf-muted sm:p-6">{t("dashboard.frmMissing")}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <FicsitPageLoader className="min-h-0 flex-1 border-0 bg-transparent" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <p className="text-sf-danger">{t("common.error")}</p>
      </div>
    );
  }

  const totalItems = mergedItems.length;

  const rowCard = (row: InventoryItemRow) => {
    const dn = itemDisplayName(row, i18n.language);
    const rateStr = formatRate(rates[row.className]);
    const amt = formatIntegerSpaces(Math.round(row.amount));
    const wikiUrl = wikiItemDetailUrl(row.className, i18n.language);
    const wikiBtn = (
      <a
        href={wikiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 rounded-lg border border-sf-border/80 bg-black/30 p-2 text-sf-muted transition-colors hover:border-sf-cyan/60 hover:text-sf-cyan"
        title={t("inventory.wikiOpen")}
        aria-label={t("inventory.wikiOpen")}
      >
        <IconBookWiki className="h-5 w-5" />
      </a>
    );
    const favBtn = readOnlyInv ?
      <span
        className={`inline-flex rounded-lg border p-2 opacity-70 ${
          row.favorite ?
            "border-sf-orange/50 bg-sf-orange/10 text-sf-orange"
          : "border-sf-border/80 bg-black/30 text-sf-muted"
        }`}
        title={t("inventory.favoriteReadOnly")}
      >
        <IconHeart filled={row.favorite} className="h-5 w-5" aria-hidden />
      </span>
    : <button
        type="button"
        className={`rounded-lg border p-2 transition-colors ${
          row.favorite
            ? "border-sf-orange/80 bg-sf-orange/15 text-sf-orange"
            : "border-sf-border/80 bg-black/30 text-sf-muted hover:border-sf-border-bright hover:text-sf-text"
        }`}
        title={row.favorite ? t("inventory.favoriteRemove") : t("inventory.favoriteAdd")}
        aria-label={row.favorite ? t("inventory.favoriteRemove") : t("inventory.favoriteAdd")}
        aria-pressed={row.favorite}
        onClick={() => toggle.mutate({ className: row.className, on: !row.favorite })}
      >
        <IconHeart filled={row.favorite} className="h-5 w-5" />
      </button>;

    return (
      <li key={row.className} className="border-b border-sf-border/35 last:border-b-0">
        <div className="p-3 sm:p-4 lg:hidden">
          <div className="flex items-start gap-3">
            <ItemThumb className={row.className} label={dn} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.95rem] font-semibold leading-snug text-sf-text">{dn}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {wikiBtn}
              {favBtn}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-sf-border/40 pt-3">
            <span className="inline-flex items-center gap-2 font-mono text-sm text-sf-cyan" title={t("inventory.total")}>
              <IconLayers className="h-4 w-4 shrink-0 opacity-85" aria-hidden />
              {amt}
            </span>
            <span
              className="inline-flex items-center gap-2 font-mono text-sm text-sf-muted"
              title={t("inventory.rateWindowHint")}
            >
              <IconTrendUp className="h-4 w-4 shrink-0 text-sf-orange/80" aria-hidden />
              {rateStr}
              <span className="text-[0.65rem] opacity-75">/min</span>
            </span>
          </div>
        </div>

        <div className="hidden grid-cols-[minmax(0,1fr)_3rem_3rem_5.5rem_6.5rem] items-center gap-2 px-3 py-2.5 transition-colors hover:bg-white/[0.03] lg:grid lg:gap-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <ItemThumb className={row.className} label={dn} size={40} />
            <div className="min-w-0">
              <p className="font-medium leading-snug text-sf-text">{dn}</p>
            </div>
          </div>
          <div className="flex justify-center">{wikiBtn}</div>
          <div className="flex justify-center">{favBtn}</div>
          <span className="text-right font-mono text-sm text-sf-cyan" title={t("inventory.total")}>
            {amt}
          </span>
          <span
            className="text-right font-mono text-sm text-sf-muted"
            title={t("inventory.rateWindowHint")}
          >
            {rateStr}
            <span className="ml-0.5 text-[0.65rem] opacity-70">/min</span>
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 sm:gap-5">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="sf-display text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl sm:tracking-[0.15em]">
            {t("inventory.title")}
          </h1>
          <p className="text-xs text-sf-muted sm:text-sm">{t("inventory.shownCount", { count: filtered.length })}</p>
        </div>
        <div
          className="inline-flex max-w-full items-center gap-2 self-start rounded border border-sf-border/70 bg-black/25 px-3 py-2 text-xs text-sf-muted"
          title={t("inventory.rateWindowHint")}
        >
          <IconTrendUp className="h-4 w-4 shrink-0 text-sf-orange/90" aria-hidden />
          <span>{t("inventory.rateWindowBadge")}</span>
        </div>
      </div>

      <div className="sf-panel shrink-0 overflow-hidden p-3 sm:p-4">
        <label className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-sf-muted" htmlFor="inv-search">
          <IconSearch className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span>{t("inventory.search")}</span>
        </label>
        <div
          className={
            "sf-input flex min-h-11 w-full items-center gap-3 !py-0 !pl-3 !pr-3 " +
            "focus-within:border-sf-cyan-dim focus-within:shadow-[0_0_0_1px_rgba(95,212,255,0.25)] sm:min-h-0 sm:!py-0"
          }
        >
          <IconSearch className="h-4 w-4 shrink-0 text-sf-muted" aria-hidden />
          <input
            ref={searchRef}
            id="inv-search"
            className="min-h-11 min-w-0 flex-1 border-0 bg-transparent py-3 text-base text-sf-text outline-none placeholder:text-sf-muted sm:min-h-0 sm:py-2 sm:text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("inventory.searchPlaceholder")}
            enterKeyHint="search"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="sf-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="sf-panel-header flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <span className="text-[0.65rem] uppercase tracking-wide text-sf-muted">{t("inventory.listTitle")}</span>
          <span className="font-mono text-[0.7rem] text-sf-muted">
            {formatIntegerSpaces(filtered.length)}/{formatIntegerSpaces(totalItems)}
          </span>
        </div>

        <div className="hidden shrink-0 border-b border-sf-border/50 bg-black/15 px-3 py-2 lg:grid lg:grid-cols-[minmax(0,1fr)_3rem_3rem_5.5rem_6.5rem] lg:items-center lg:gap-3 lg:px-4 lg:text-[0.6rem] lg:font-medium lg:uppercase lg:tracking-wider lg:text-sf-muted">
          <span className="flex items-center gap-2 pl-1">
            <IconLayers className="h-4 w-4 opacity-70" aria-hidden />
            {t("inventory.item")}
          </span>
          <span className="text-center" title={t("inventory.wikiOpen")}>
            <IconBookWiki className="mx-auto h-4 w-4 opacity-70" />
            <span className="sr-only">{t("inventory.wikiOpen")}</span>
          </span>
          <span className="text-center" title={t("inventory.favorite")}>
            <IconHeart filled={false} className="mx-auto h-4 w-4 opacity-70" />
            <span className="sr-only">{t("inventory.favorite")}</span>
          </span>
          <span className="flex items-center justify-end gap-1" title={t("inventory.total")}>
            <IconLayers className="h-4 w-4 opacity-70" aria-hidden />
            <span className="hidden xl:inline">{t("inventory.total")}</span>
          </span>
          <span className="flex items-center justify-end gap-1" title={t("inventory.rateWindowHint")}>
            <IconTrendUp className="h-4 w-4 opacity-70" aria-hidden />
            <span className="hidden xl:inline">{t("inventory.ratePerMin")}</span>
          </span>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filtered.map((row) => rowCard(row))}
        </ul>
      </div>
    </div>
  );
}
