import { apiFetch } from "@/lib/api";
import { frmWriteUrl } from "@/lib/frmApi";

const BUILD_EN_PREFIX = "sf_frm_build_en:";

export function cacheBuildingEnabled(id: string, enabled: boolean): void {
  try {
    sessionStorage.setItem(`${BUILD_EN_PREFIX}${id}`, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readCachedBuildingEnabled(id: string): boolean | undefined {
  try {
    const v = sessionStorage.getItem(`${BUILD_EN_PREFIX}${id}`);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return undefined;
}

export function parseSetEnabledStatus(data: unknown): boolean | undefined {
  if (!Array.isArray(data) || !data.length) return undefined;
  const row = data[0] as Record<string, unknown>;
  const s = row.Status ?? row.status;
  if (typeof s === "boolean") return s;
  return undefined;
}

export function parseSetSwitchesStatus(data: unknown): boolean | undefined {
  if (!Array.isArray(data) || !data.length) return undefined;
  const row = data[0] as Record<string, unknown>;
  const s = row.Status ?? row.status;
  if (typeof s === "boolean") return s;
  return undefined;
}

export async function postSetEnabled(body: { ID: string; status: boolean }): Promise<unknown> {
  return apiFetch<unknown>(frmWriteUrl("setEnabled"), { method: "POST", json: body });
}

export async function postSetSwitches(body: { ID: string; status?: boolean; name?: string; priority?: number }): Promise<unknown> {
  return apiFetch<unknown>(frmWriteUrl("setSwitches"), { method: "POST", json: body });
}

export function switchRowIsOn(r: Record<string, unknown>): boolean {
  const v = r.IsOn ?? r.isOn;
  if (typeof v === "boolean") return v;
  const s = r.Status ?? r.status;
  if (typeof s === "boolean") return s;
  return false;
}

export function switchRowId(r: Record<string, unknown>): string {
  return String(r.ID ?? r.Id ?? r.id ?? "").trim();
}
