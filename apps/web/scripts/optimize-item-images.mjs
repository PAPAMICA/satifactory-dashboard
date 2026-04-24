/**
 * Génère des WebP à côté des PNG sous src/img/ (même arbre, extension .webp).
 * Idempotent : ignore si le .webp existe et est plus récent que le .png.
 * @packageDocumentation
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG_ROOT = path.resolve(__dirname, "../src/img");
const CONCURRENCY = 6;

async function collectPngFiles(dir, acc = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await collectPngFiles(full, acc);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".png")) acc.push(full);
  }
  return acc;
}

async function needsConvert(pngPath, webpPath) {
  try {
    const [ps, ws] = await Promise.all([fs.stat(pngPath), fs.stat(webpPath).catch(() => null)]);
    if (!ws) return true;
    return ps.mtimeMs > ws.mtimeMs;
  } catch {
    return true;
  }
}

async function convertOne(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, ".webp");
  if (!(await needsConvert(pngPath, webpPath))) return "skip";

  await fs.mkdir(path.dirname(webpPath), { recursive: true });
  await sharp(pngPath).webp({ quality: 82, effort: 5 }).toFile(webpPath);
  return "ok";
}

const pngList = await collectPngFiles(IMG_ROOT);
if (!pngList.length) {
  console.warn("[optimize-item-images] Aucun PNG sous", IMG_ROOT);
  process.exit(0);
}

const t0 = Date.now();
const outcomes = [];
for (let i = 0; i < pngList.length; i += CONCURRENCY) {
  const chunk = pngList.slice(i, i + CONCURRENCY);
  outcomes.push(...(await Promise.all(chunk.map((f) => convertOne(f)))));
}
const ok = outcomes.filter((o) => o === "ok").length;
const skipped = outcomes.filter((o) => o === "skip").length;
console.log(
  `[optimize-item-images] ${pngList.length} PNG — ${ok} convertis, ${skipped} déjà à jour — ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
