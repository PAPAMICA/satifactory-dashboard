import type { Layout } from "react-grid-layout";

export type WidgetVariant = "standard" | "visual";

/** Épingle du widget « Contrôle » (interrupteurs / bâtiments). */
export type ControlPinMeta = {
  kind: "switch" | "building";
  id: string;
  label?: string;
};

export type WidgetMetaEntry = {
  type?: string;
  variant?: WidgetVariant;
  /** Widget `sink` : ne pas afficher les lignes du sink exploration. */
  hideSinkExploration?: boolean;
  /** Widget `ctrl` : raccourcis interrupteurs / bâtiments. */
  controlPins?: ControlPinMeta[];
};

export type DashboardWidgetDef = {
  id: string;
  type: string;
  titleKey: string;
  /** Classe Satisfactory pour l’icône PNG (en-tête et catalogue). */
  artClassName: string;
  defaultLayout: Pick<Layout, "w" | "h" | "minW" | "minH">;
  /** Liste « Ajouter un widget » (tous les types connus) */
  inCatalog: boolean;
  removable: boolean;
};

export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  {
    id: "power",
    type: "power_overview",
    titleKey: "dashboard.powerTitle",
    artClassName: "Build_GeneratorFuel_C",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "chart",
    type: "power_history",
    titleKey: "dashboard.chartTitle",
    artClassName: "Build_PowerStorageMk1_C",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "fav",
    type: "favorites",
    titleKey: "dashboard.favoritesTitle",
    artClassName: "Build_CentralStorage_C",
    defaultLayout: { w: 12, h: 3, minW: 4, minH: 2 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "session",
    type: "session_info",
    titleKey: "dashboard.widgets.session",
    artClassName: "Build_TradingPost_C",
    defaultLayout: { w: 4, h: 4, minW: 3, minH: 3 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "hub",
    type: "hub_milestone",
    titleKey: "dashboard.widgets.hubMilestone",
    artClassName: "Build_TradingPost_C",
    defaultLayout: { w: 8, h: 5, minW: 4, minH: 4 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "elevator",
    type: "space_elevator",
    titleKey: "dashboard.widgets.spaceElevator",
    artClassName: "Build_SpaceElevator_C",
    defaultLayout: { w: 8, h: 5, minW: 4, minH: 4 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "sink",
    type: "resource_sink",
    titleKey: "dashboard.widgets.sinkCatalog",
    artClassName: "Build_ResourceSink_C",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "drones",
    type: "drone_overview",
    titleKey: "dashboard.widgets.dronesCatalog",
    artClassName: "Desc_DroneTransport_C",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "mapmk",
    type: "map_markers",
    titleKey: "dashboard.widgets.mapMarkersCatalog",
    artClassName: "Build_RadarTower_C",
    defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "players",
    type: "players_online",
    titleKey: "dashboard.widgets.playersCatalog",
    artClassName: "Build_StoragePlayer_C",
    defaultLayout: { w: 4, h: 3, minW: 3, minH: 2 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "pwruse",
    type: "power_usage_top",
    titleKey: "dashboard.widgets.powerUsageCatalog",
    artClassName: "Build_PowerTower_C",
    defaultLayout: { w: 6, h: 4, minW: 4, minH: 3 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "gen",
    type: "generators_overview",
    titleKey: "dashboard.widgets.generatorsCatalog",
    artClassName: "Build_GeneratorNuclear_C",
    defaultLayout: { w: 6, h: 4, minW: 4, minH: 3 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "fabric",
    type: "factory_list",
    titleKey: "dashboard.widgets.factoryCatalog",
    artClassName: "Build_ManufacturerMk1_C",
    defaultLayout: { w: 8, h: 5, minW: 4, minH: 4 },
    inCatalog: true,
    removable: true,
  },
  {
    id: "ctrl",
    type: "control_pins",
    titleKey: "dashboard.widgets.controlCatalog",
    artClassName: "Build_PriorityPowerSwitch_C",
    defaultLayout: { w: 5, h: 4, minW: 3, minH: 3 },
    inCatalog: true,
    removable: true,
  },
];

export function dashboardWidgetById(id: string): DashboardWidgetDef | undefined {
  return DASHBOARD_WIDGETS.find((w) => w.id === id);
}

export function catalogWidgets(): DashboardWidgetDef[] {
  return DASHBOARD_WIDGETS.filter((w) => w.inCatalog);
}

export function newLayoutItemForWidget(id: string, layout: Layout[]): Layout {
  const def = dashboardWidgetById(id);
  if (!def) {
    throw new Error(`Unknown dashboard widget: ${id}`);
  }
  const maxY = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
  return {
    i: id,
    x: 0,
    y: maxY,
    w: def.defaultLayout.w,
    h: def.defaultLayout.h,
    minW: def.defaultLayout.minW,
    minH: def.defaultLayout.minH,
  };
}

export function ensureWidgetMeta(
  layout: Layout[],
  prev: Record<string, WidgetMetaEntry>,
): Record<string, WidgetMetaEntry> {
  const next: Record<string, WidgetMetaEntry> = {};
  for (const item of layout) {
    const def = dashboardWidgetById(item.i);
    if (!def) continue;
    const old = prev[item.i];
    const v: WidgetVariant = old?.variant === "visual" ? "visual" : "standard";
    const entry: WidgetMetaEntry = { type: def.type, variant: v };
    if (def.id === "sink" && old?.hideSinkExploration === true) {
      entry.hideSinkExploration = true;
    }
    if (def.id === "ctrl" && Array.isArray(old?.controlPins) && old.controlPins.length) {
      entry.controlPins = old.controlPins;
    }
    next[item.i] = entry;
  }
  return next;
}
