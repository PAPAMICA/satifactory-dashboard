import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { authenticateRequest, denyIfPublicViewer, hashPassword, requireAdmin } from "./auth.js";
import { bootstrapAdminFromEnv } from "./bootstrap.js";
import { deleteKv, getDb, getKv, setKv } from "./db.js";
import { getFrmConfig, frmFetchJson, frmPostJson } from "./frm.js";
import { buildInventorySummary } from "./inventory.js";
import { queryPowerHistorySince } from "./powerTimeseries.js";
import { startPowerSampler } from "./powerSampler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
const publicDir = path.join(__dirname, "..", "public");

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: isProd ? false : ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
});

app.get("/health", async () => ({ ok: true }));

app.get("/api/init-status", async () => {
  const count = (
    getDb().prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }
  ).c;
  return { needsSetup: count === 0 };
});

app.register(async (scope) => {
  scope.addHook("preHandler", authenticateRequest);

  scope.get("/api/me", async (req) => ({
    id: req.user!.id,
    username: req.user!.username,
    isAdmin: req.user!.isAdmin,
    isPublicViewer: Boolean(req.user!.isPublicViewer),
  }));

  scope.get("/api/settings", async (req) => {
    const cfg = getFrmConfig();
    const poll = Number(getKv("poll_interval_ms") ?? "10000") || 10000;
    const pubConfigured = Boolean(getKv("public_viewer_password_hash")?.trim());
    if (req.user?.isPublicViewer) {
      return {
        frmBaseUrl: "",
        frmTokenConfigured: Boolean(cfg?.baseUrl && cfg?.token),
        pollIntervalMs: poll,
        publicViewerPasswordConfigured: false,
      };
    }
    return {
      frmBaseUrl: cfg?.baseUrl ?? "",
      frmTokenConfigured: Boolean(cfg?.token),
      pollIntervalMs: poll,
      publicViewerPasswordConfigured: pubConfigured,
    };
  });

  scope.put("/api/settings", async (req, reply) => {
    requireAdmin(req, reply);
    if (reply.sent) return;

    const body = (req.body ?? {}) as {
      frmBaseUrl?: string;
      frmToken?: string;
      pollIntervalMs?: number;
      publicViewerPassword?: string;
      publicViewerPasswordConfirm?: string;
      clearPublicViewerPassword?: boolean;
    };

    if (body.clearPublicViewerPassword === true) {
      deleteKv("public_viewer_password_hash");
    } else if (typeof body.publicViewerPassword === "string" && body.publicViewerPassword.length > 0) {
      if (body.publicViewerPassword !== body.publicViewerPasswordConfirm) {
        return reply.code(400).send({ error: "Public viewer password confirmation mismatch" });
      }
      if (body.publicViewerPassword.length < 4) {
        return reply.code(400).send({ error: "Public viewer password too short" });
      }
      setKv("public_viewer_password_hash", hashPassword(body.publicViewerPassword));
    }

    if (typeof body.frmBaseUrl === "string") {
      setKv("frm_base_url", body.frmBaseUrl.trim().replace(/\/$/, ""));
    }
    if (typeof body.frmToken === "string" && body.frmToken.length > 0) {
      setKv("frm_token", body.frmToken.trim());
    }
    if (typeof body.pollIntervalMs === "number" && body.pollIntervalMs >= 2000) {
      setKv("poll_interval_ms", String(Math.min(body.pollIntervalMs, 120_000)));
    }

    return { ok: true };
  });

  scope.get("/api/dashboard/layout", async () => {
    const raw = getKv("dashboard_layout");
    if (!raw) {
      return {
        layout: defaultLayout(),
        widgetMeta: defaultWidgetMeta(),
      };
    }
    try {
      return JSON.parse(raw) as {
        layout: unknown[];
        widgetMeta: Record<string, unknown>;
      };
    } catch {
      return { layout: defaultLayout(), widgetMeta: defaultWidgetMeta() };
    }
  });

  scope.put("/api/dashboard/layout", async (req, reply) => {
    if (denyIfPublicViewer(req, reply)) return;
    const body = req.body as { layout?: unknown[]; widgetMeta?: Record<string, unknown> };
    if (!body?.layout || !Array.isArray(body.layout)) {
      return reply.code(400).send({ error: "Invalid layout" });
    }
    setKv(
      "dashboard_layout",
      JSON.stringify({
        layout: body.layout,
        widgetMeta: body.widgetMeta ?? {},
      }),
    );
    return { ok: true };
  });

  scope.get("/api/favorites", async () => {
    const rows = getDb()
      .prepare("SELECT class_name FROM favorites ORDER BY class_name")
      .all() as { class_name: string }[];
    return { favorites: rows.map((r) => r.class_name) };
  });

  scope.post("/api/favorites/:className", async (req, reply) => {
    if (denyIfPublicViewer(req, reply)) return;
    const className = decodeURIComponent((req.params as { className: string }).className);
    if (!className) return reply.code(400).send({ error: "Missing className" });
    getDb()
      .prepare("INSERT OR IGNORE INTO favorites (class_name) VALUES (?)")
      .run(className);
    return { ok: true };
  });

  scope.delete("/api/favorites/:className", async (req, reply) => {
    if (denyIfPublicViewer(req, reply)) return;
    const className = decodeURIComponent((req.params as { className: string }).className);
    getDb().prepare("DELETE FROM favorites WHERE class_name = ?").run(className);
    return { ok: true };
  });

  scope.get("/api/inventory/summary", async (req, reply) => {
    try {
      const items = await buildInventorySummary();
      return { items };
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: e instanceof Error ? e.message : "Inventory fetch failed",
      });
    }
  });

  scope.get("/api/frm/:path", async (req, reply) => {
    const pathParam = (req.params as { path: string }).path;
    const sub = pathParam.startsWith("/") ? pathParam : `/${pathParam}`;
    if (!getFrmConfig()) {
      return reply.code(400).send({ error: "FRM not configured" });
    }
    try {
      const data = await frmFetchJson<unknown>(sub);
      void reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
      return data;
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: e instanceof Error ? e.message : "FRM proxy error",
      });
    }
  });

  /** Relais POST vers FRM — chemins Write uniquement (doc-api/_write.adoc). */
  const frmWritePaths = new Set([
    "setSwitches",
    "setEnabled",
    "sendChatMessage",
    "createPing",
    "setModSetting",
  ]);

  scope.post("/api/frm/write/:path", async (req, reply) => {
    if (denyIfPublicViewer(req, reply)) return;
    const pathParam = (req.params as { path: string }).path;
    if (!frmWritePaths.has(pathParam)) {
      return reply.code(403).send({ error: "FRM write path not allowed" });
    }
    if (!getFrmConfig()) {
      return reply.code(400).send({ error: "FRM not configured" });
    }
    try {
      const data = await frmPostJson<unknown>(`/${pathParam}`, req.body ?? {});
      void reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
      return data;
    } catch (e) {
      req.log.error(e);
      return reply.code(502).send({
        error: e instanceof Error ? e.message : "FRM proxy error",
      });
    }
  });

  /** Historique énergie (SQLite, série temporelle indexée par `ts_ms`). */
  scope.get("/api/metrics/power/history", async (req, reply) => {
    if (denyIfPublicViewer(req, reply)) return;
    const q = req.query as { hours?: string; minutes?: string; maxPoints?: string };
    const maxPoints = Math.min(5000, Math.max(20, Number(q.maxPoints) || 400));
    const capMin = 7 * 24 * 60;
    const minParsed = Number(q.minutes);
    let sinceMs: number;
    if (Number.isFinite(minParsed) && minParsed > 0) {
      const minutes = Math.min(capMin, Math.max(1, minParsed));
      sinceMs = Date.now() - minutes * 60_000;
    } else {
      const hours = Math.min(168, Math.max(1, Number(q.hours) || 24));
      sinceMs = Date.now() - hours * 3_600_000;
    }
    const points = queryPowerHistorySince(sinceMs, maxPoints);
    void reply.header("Cache-Control", "no-store");
    return { points };
  });

  scope.get("/api/admin/users", async (req, reply) => {
    requireAdmin(req, reply);
    if (reply.sent) return;
    const rows = getDb()
      .prepare("SELECT id, username, is_admin FROM users ORDER BY id")
      .all() as { id: number; username: string; is_admin: number }[];
    return {
      users: rows.map((r) => ({
        id: r.id,
        username: r.username,
        isAdmin: Boolean(r.is_admin),
      })),
    };
  });

  scope.post("/api/admin/users", async (req, reply) => {
    requireAdmin(req, reply);
    if (reply.sent) return;
    const body = (req.body ?? {}) as {
      username?: string;
      password?: string;
      isAdmin?: boolean;
    };
    if (!body.username?.trim() || !body.password) {
      return reply.code(400).send({ error: "username and password required" });
    }
    try {
      getDb()
        .prepare(
          "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)",
        )
        .run(
          body.username.trim(),
          hashPassword(body.password),
          body.isAdmin ? 1 : 0,
        );
      return { ok: true };
    } catch {
      return reply.code(409).send({ error: "Username exists" });
    }
  });

  scope.delete("/api/admin/users/:id", async (req, reply) => {
    requireAdmin(req, reply);
    if (reply.sent) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id) || id === req.user!.id) {
      return reply.code(400).send({ error: "Cannot delete self or invalid id" });
    }
    getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
    return { ok: true };
  });

});

/** First-time setup without env: POST /api/setup { username, password } when no users */
app.post("/api/setup", async (req, reply) => {
  const count = (
    getDb().prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }
  ).c;
  if (count > 0) {
    return reply.code(403).send({ error: "Already initialized" });
  }
  const body = (req.body ?? {}) as { username?: string; password?: string };
  if (!body.username?.trim() || !body.password) {
    return reply.code(400).send({ error: "username and password required" });
  }
  getDb()
    .prepare(
      "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)",
    )
    .run(body.username.trim(), hashPassword(body.password));
  return { ok: true, username: body.username.trim() };
});

function defaultLayout() {
  return [
    { i: "power", x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    { i: "chart", x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
    { i: "fav", x: 0, y: 4, w: 12, h: 3, minW: 4, minH: 2 },
  ];
}

function defaultWidgetMeta() {
  return {
    power: { type: "power_overview" },
    chart: { type: "power_history" },
    fav: { type: "favorites" },
  };
}

if (isProd) {
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

const port = Number(process.env.PORT ?? "3001");
const host = process.env.HOST ?? "0.0.0.0";

getDb();
bootstrapAdminFromEnv();

const stopPowerSampler = startPowerSampler(
  () => Number(getKv("poll_interval_ms") ?? "10000") || 10_000,
  app.log,
);
app.addHook("onClose", async () => {
  stopPowerSampler();
});

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
