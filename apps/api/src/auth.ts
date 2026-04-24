import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getPool, getKv, type UserRow } from "./db.js";

/** Nom d’utilisateur Basic réservé pour l’accès consultation (mot de passe défini dans Paramètres). */
export const PUBLIC_VIEWER_USERNAME = "public";

const KV_PUBLIC_VIEWER_PASSWORD_HASH = "public_viewer_password_hash";

export type AuthedUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  /** Connexion `public` + mot de passe paramétré (lecture seule). */
  isPublicViewer?: boolean;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthedUser;
  }
}

export function parseBasicAuth(
  header: string | undefined,
): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  const b64 = header.slice(6).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return {
    username: decoded.slice(0, idx),
    password: decoded.slice(idx + 1),
  };
}

export async function authenticateRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const creds = parseBasicAuth(req.headers.authorization);
  if (!creds?.username) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  if (creds.username.toLowerCase() === PUBLIC_VIEWER_USERNAME.toLowerCase()) {
    const hash = (await getKv(KV_PUBLIC_VIEWER_PASSWORD_HASH))?.trim();
    if (!hash || !bcrypt.compareSync(creds.password, hash)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    req.user = {
      id: -1,
      username: PUBLIC_VIEWER_USERNAME,
      isAdmin: false,
      isPublicViewer: true,
    };
    return;
  }

  const { rows } = await getPool().query<UserRow>("SELECT * FROM users WHERE username = $1", [creds.username]);
  const row = rows[0];

  if (!row || !bcrypt.compareSync(creds.password, row.password_hash)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  req.user = {
    id: row.id,
    username: row.username,
    isAdmin: Boolean(row.is_admin),
  };
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user?.isAdmin) {
    return reply.code(403).send({ error: "Admin only" });
  }
}

/** `true` si la réponse 403 a déjà été envoyée (accès public = lecture seule). */
export function denyIfPublicViewer(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.user?.isPublicViewer) {
    void reply.code(403).send({ error: "Read-only" });
    return true;
  }
  return false;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 12);
}
