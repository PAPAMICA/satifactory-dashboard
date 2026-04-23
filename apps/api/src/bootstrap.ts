import { hashPassword } from "./auth.js";
import { getDb } from "./db.js";

/** Create first admin from env if database has no users. */
export function bootstrapAdminFromEnv() {
  const u = process.env.INIT_ADMIN_USERNAME?.trim();
  const p = process.env.INIT_ADMIN_PASSWORD;
  if (!u || !p) return;

  const count = (
    getDb().prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }
  ).c;
  if (count > 0) return;

  getDb()
    .prepare(
      "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)",
    )
    .run(u, hashPassword(p));
  // eslint-disable-next-line no-console
  console.log(`[bootstrap] Created admin user "${u}" from INIT_ADMIN_* env`);
}
