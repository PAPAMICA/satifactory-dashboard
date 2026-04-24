import { hashPassword } from "./auth.js";
import { getPool } from "./db.js";

/** Create first admin from env if database has no users. */
export async function bootstrapAdminFromEnv() {
  const u = process.env.INIT_ADMIN_USERNAME?.trim();
  const p = process.env.INIT_ADMIN_PASSWORD;
  if (!u || !p) return;

  const { rows } = await getPool().query<{ c: string }>("SELECT COUNT(*)::text AS c FROM users");
  const count = Number(rows[0]?.c ?? "0");
  if (count > 0) return;

  await getPool().query("INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, 1)", [
    u,
    hashPassword(p),
  ]);
  // eslint-disable-next-line no-console
  console.log(`[bootstrap] Created admin user "${u}" from INIT_ADMIN_* env`);
}
