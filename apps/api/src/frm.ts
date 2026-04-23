import { getKv } from "./db.js";

export function getFrmConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (getKv("frm_base_url") ?? "").trim().replace(/\/$/, "");
  const token = (getKv("frm_token") ?? "").trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

export async function frmFetchJson<T>(path: string): Promise<T> {
  const cfg = getFrmConfig();
  if (!cfg) {
    throw new Error("FRM not configured");
  }
  const url = `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: { "X-FRM-Authorization": cfg.token },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FRM ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** POST JSON vers FRM (endpoints Write documentés). */
export async function frmPostJson<T>(path: string, body: unknown): Promise<T> {
  const cfg = getFrmConfig();
  if (!cfg) {
    throw new Error("FRM not configured");
  }
  const url = `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-FRM-Authorization": cfg.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FRM ${res.status}: ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as T;
}
