import { useMemo, useState } from "react";
import { markerLocation } from "@/lib/mapMarkerDisplay";

/**
 * Recherche + filtre par type de repère (partagé page carte / widget dashboard).
 */
export function useFrmMapMarkerFilters(markers: Record<string, unknown>[]) {
  const [search, setSearch] = useState("");
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(() => new Set());

  const typesPresent = useMemo(() => {
    const s = new Set<string>();
    for (const r of markers) {
      const k = String(r.MapMarkerType ?? r.mapMarkerType ?? "RT_Default");
      s.add(k);
    }
    return [...s].sort();
  }, [markers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return markers.filter((r) => {
      const typ = String(r.MapMarkerType ?? r.mapMarkerType ?? "RT_Default");
      if (hiddenTypes.has(typ)) return false;
      if (!q) return true;
      const nm = String(r.Name ?? r.name ?? "").toLowerCase();
      const cat = String(r.Category ?? r.category ?? "").toLowerCase();
      return nm.includes(q) || cat.includes(q);
    });
  }, [markers, search, hiddenTypes]);

  const fitBoundsKey = useMemo(() => {
    const stableId = (r: Record<string, unknown>, i: number) => {
      const id = String(r.ID ?? r.Id ?? "").trim();
      if (id) return id;
      const { x, y } = markerLocation(r);
      const nx = Number(x);
      const ny = Number(y);
      if (Number.isFinite(nx) && Number.isFinite(ny)) return `pos:${nx},${ny},${i}`;
      return `row:${i}`;
    };
    const ids = filtered.map((r, i) => stableId(r, i)).sort().join("|");
    const hid = [...hiddenTypes].sort().join(",");
    return `${ids}#${search.trim()}#${hid}`;
  }, [filtered, search, hiddenTypes]);

  const toggleType = (typ: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typ)) next.delete(typ);
      else next.add(typ);
      return next;
    });
  };

  const showAllTypes = () => setHiddenTypes(new Set());

  return {
    search,
    setSearch,
    hiddenTypes,
    typesPresent,
    filtered,
    fitBoundsKey,
    toggleType,
    showAllTypes,
  };
}

