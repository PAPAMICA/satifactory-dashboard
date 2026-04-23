import { gameXYToLatLng } from "./satisfactoryMapProjection";

/** Repli d’icône `ItemThumb` selon `MapMarkerType` FRM (sans `ClassName`). */
const MAP_MARKER_TYPE_THUMB: Record<string, string> = {
  RT_Default: "Build_RadarTower_C",
  RT_Beacon: "Build_RadarTower_C",
  RT_Crate: "Build_StorageContainerMk2_C",
  RT_Hub: "Build_TradingPost_C",
  RT_Ping: "Build_RadarTower_C",
  RT_Player: "Build_StoragePlayer_C",
  RT_RadarTower: "Build_RadarTower_C",
  RT_Resource: "Desc_OreIron_C",
  RT_SpaceElevator: "Build_SpaceElevator_C",
  RT_StartingPod: "Build_TradingPost_C",
  RT_Train: "Build_TrainStation_C",
  RT_TrainStation: "Build_TrainStation_C",
  RT_Vehicle: "Desc_Truck_C",
  RT_VehicleDockingStation: "Build_TruckStation_C",
  RT_DronePort: "Build_DroneStation_C",
  RT_Drone: "Desc_DroneTransport_C",
  RT_MapMarker: "Build_RadarTower_C",
  RT_Stamp: "Build_RadarTower_C",
  RT_Portal: "Build_Portal_C",
  RT_DeathCrate: "Build_StorageContainerMk2_C",
  RT_DismantleCrate: "Build_StorageContainerMk2_C",
};

export function markerLocation(r: Record<string, unknown>): { x: unknown; y: unknown; z: unknown } {
  const l = (r.location ?? r.Location) as Record<string, unknown> | undefined;
  return { x: l?.x ?? r.x, y: l?.y ?? r.y, z: l?.z ?? r.z };
}

export function markerLatLng(r: Record<string, unknown>): [number, number] | null {
  const { x, y } = markerLocation(r);
  const nx = Number(x);
  const ny = Number(y);
  return gameXYToLatLng(nx, ny);
}

export function thumbClassForMapMarker(r: Record<string, unknown>): string {
  const c = String(r.ClassName ?? r.className ?? "").trim();
  if (c) return c;
  const mt = String(r.MapMarkerType ?? r.mapMarkerType ?? "RT_Default");
  return MAP_MARKER_TYPE_THUMB[mt] ?? MAP_MARKER_TYPE_THUMB.RT_Default;
}

/** `ColorSlot` FRM (souvent 8 hex). Retourne une couleur CSS ou null. */
export function colorSlotToCss(colorSlot: unknown): string | null {
  if (colorSlot == null) return null;
  const s = String(colorSlot).replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) return null;
  if (s.length === 8) return `#${s.slice(0, 6)}`;
  if (s.length === 6) return `#${s}`;
  return null;
}
