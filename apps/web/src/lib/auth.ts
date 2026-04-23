const KEY = "sf_basic";

export function setCredentials(username: string, password: string) {
  const token = btoa(`${username}:${password}`);
  sessionStorage.setItem(KEY, token);
}

export function clearCredentials() {
  sessionStorage.removeItem(KEY);
}

/** Déconnexion complète. */
export function clearAllAuth() {
  sessionStorage.removeItem(KEY);
}

export function getAuthHeader(): string | undefined {
  const t = sessionStorage.getItem(KEY);
  return t ? `Basic ${t}` : undefined;
}

export function isLoggedIn(): boolean {
  return Boolean(sessionStorage.getItem(KEY));
}

/** Nom d’utilisateur réservé côté API pour l’accès consultation (mot de passe dans Paramètres). */
export const PUBLIC_VIEWER_LOGIN = "public";
