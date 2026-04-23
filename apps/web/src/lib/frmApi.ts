/** URL proxy GET vers FRM (serveur ajoute le token). */
export function frmGetUrl(frmPath: string): string {
  const p = frmPath.replace(/^\//, "");
  return `/api/frm/${encodeURIComponent(p)}`;
}

/** Chemins Write autorisés par l’API (voir doc-api/_write.adoc). */
export type FrmWritePath = "setSwitches" | "setEnabled" | "sendChatMessage" | "createPing" | "setModSetting";

export function frmWriteUrl(path: FrmWritePath): string {
  return `/api/frm/write/${path}`;
}
