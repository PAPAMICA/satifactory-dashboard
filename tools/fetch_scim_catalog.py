#!/usr/bin/env python3
"""
Télécharge icônes + traductions FR/EN pour les listes SCIM (bâtiments, structures, etc.).

Par défaut : buildings, architecture, structures, tools, vehicles, fauna, statues.

Sortie (défaut : apps/web/src) :
  - img/<slug>/<id>.png
  - traductions/fr/<slug>.json
  - traductions/en/<slug>.json
"""

from __future__ import annotations

import argparse
import sys
import time
import urllib.error
from pathlib import Path

from scim_listing import BASE, download_file, extension_from_url, fetch, parse_listing_page, write_json

DEFAULT_SLUGS = (
    "buildings",
    "architecture",
    "structures",
    "tools",
    "vehicles",
    "fauna",
    "statues",
)


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def default_web_src() -> Path:
    return repo_root() / "apps" / "web" / "src"


def sync_category(
    slug: str,
    out_root: Path,
    sleep: float,
    skip_images: bool,
) -> list[str]:
    """Télécharge une catégorie. Retourne la liste des messages d'erreur (images)."""
    fr_html = fetch(f"{BASE}/fr/{slug}")
    en_html = fetch(f"{BASE}/en/{slug}")

    fr_items = parse_listing_page(fr_html, "fr", slug)
    en_items = parse_listing_page(en_html, "en", slug)

    if not fr_items or not en_items:
        raise RuntimeError(
            f"{slug}: parsing vide (FR={len(fr_items)}, EN={len(en_items)}) — HTML modifié ?"
        )

    ids_fr = set(fr_items)
    ids_en = set(en_items)
    if ids_fr != ids_en:
        raise RuntimeError(
            f"{slug}: ids FR ({len(ids_fr)}) et EN ({len(ids_en)}) diffèrent "
            f"(ex. manquants EN: {sorted(ids_fr - ids_en)[:5]})."
        )

    names_fr = {i: fr_items[i][1] for i in sorted(ids_fr)}
    names_en = {i: en_items[i][1] for i in sorted(ids_en)}
    write_json(out_root / "traductions" / "fr" / f"{slug}.json", names_fr)
    write_json(out_root / "traductions" / "en" / f"{slug}.json", names_en)

    errors: list[str] = []
    if skip_images:
        print(f"  {slug}: {len(names_fr)} entrées (JSON seulement).")
        return errors

    img_dir = out_root / "img" / slug
    ids_sorted = sorted(ids_fr)
    for idx, item_id in enumerate(ids_sorted):
        url = fr_items[item_id][0]
        ext = extension_from_url(url)
        dest = img_dir / f"{item_id}{ext}"
        try:
            download_file(url, dest)
        except (urllib.error.URLError, OSError) as e:
            errors.append(f"{slug}/{item_id}: {e}")
        if sleep > 0 and idx < len(ids_sorted) - 1:
            time.sleep(sleep)

    status = f"{len(names_fr)} images" if not errors else f"{len(ids_sorted) - len(errors)} ok, {len(errors)} erreur(s)"
    print(f"  {slug}: {status} -> {img_dir}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Récupère images + noms FR/EN (listes SCIM).")
    parser.add_argument(
        "--out",
        type=Path,
        default=default_web_src(),
        help="Racine de sortie (défaut : apps/web/src).",
    )
    parser.add_argument(
        "--slugs",
        type=str,
        default=",".join(DEFAULT_SLUGS),
        help="Segments d'URL séparés par des virgules (défaut : les 7 catégories).",
    )
    parser.add_argument("--sleep", type=float, default=0.05, help="Pause entre images (s).")
    parser.add_argument("--skip-images", action="store_true", help="JSON uniquement.")
    parser.add_argument(
        "--strict-images",
        action="store_true",
        help="Code de sortie 1 si au moins une image échoue (défaut : 0 si seuls les PNG posent problème).",
    )
    args = parser.parse_args()
    out_root: Path = args.out.resolve()
    slugs = tuple(s.strip() for s in args.slugs.split(",") if s.strip())

    all_errors: list[str] = []
    for slug in slugs:
        try:
            all_errors.extend(sync_category(slug, out_root, args.sleep, args.skip_images))
        except RuntimeError as e:
            print(f"ERREUR: {e}", file=sys.stderr)
            return 1

    if all_errors:
        print(f"\nAvertissement : {len(all_errors)} image(s) non téléchargée(s) (404 ou réseau).")
        for line in all_errors[:25]:
            print(line)
        if len(all_errors) > 25:
            print(f"... et {len(all_errors) - 25} autre(s).")
        if args.strict_images:
            return 1

    print(f"\nOK — sortie : {out_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
