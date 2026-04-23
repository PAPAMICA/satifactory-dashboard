#!/usr/bin/env python3
"""
Télécharge les icônes des objets (items) depuis satisfactory-calculator.com + JSON FR/EN.

Sources :
  - https://satisfactory-calculator.com/fr/items
  - https://satisfactory-calculator.com/en/items

Sortie (défaut : apps/web/src) :
  - img/items/<id>.png
  - traductions/fr/items.json
  - traductions/en/items.json

Pour les autres listes (bâtiments, structures, …), voir fetch_scim_catalog.py.
"""

from __future__ import annotations

import argparse
import time
import urllib.error
from pathlib import Path

from scim_listing import BASE, download_file, extension_from_url, fetch, parse_listing_page, write_json

ITEMS_SLUG = "items"


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def default_web_src() -> Path:
    return repo_root() / "apps" / "web" / "src"


def main() -> int:
    parser = argparse.ArgumentParser(description="Récupère images + noms FR/EN des items SCIM.")
    parser.add_argument(
        "--out",
        type=Path,
        default=default_web_src(),
        help="Répertoire racine de sortie (défaut : apps/web/src).",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.08,
        help="Pause en secondes entre chaque téléchargement d'image (défaut : 0.08).",
    )
    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="N'écrire que les JSON, sans télécharger les images.",
    )
    args = parser.parse_args()
    out_root: Path = args.out.resolve()

    fr_html = fetch(f"{BASE}/fr/{ITEMS_SLUG}")
    en_html = fetch(f"{BASE}/en/{ITEMS_SLUG}")

    fr_items = parse_listing_page(fr_html, "fr", ITEMS_SLUG)
    en_items = parse_listing_page(en_html, "en", ITEMS_SLUG)

    if not fr_items or not en_items:
        raise SystemExit("Échec du parsing : aucun item trouvé (structure HTML modifiée ?).")

    ids_fr = set(fr_items)
    ids_en = set(en_items)
    if ids_fr != ids_en:
        missing_fr = sorted(ids_en - ids_fr)
        missing_en = sorted(ids_fr - ids_en)
        raise SystemExit(
            "Les jeux d'ids FR et EN diffèrent.\n"
            f"Manquants côté FR ({len(missing_fr)}): {missing_fr[:10]}{'…' if len(missing_fr) > 10 else ''}\n"
            f"Manquants côté EN ({len(missing_en)}): {missing_en[:10]}{'…' if len(missing_en) > 10 else ''}"
        )

    names_fr = {i: fr_items[i][1] for i in sorted(ids_fr)}
    names_en = {i: en_items[i][1] for i in sorted(ids_en)}
    write_json(out_root / "traductions" / "fr" / "items.json", names_fr)
    write_json(out_root / "traductions" / "en" / "items.json", names_en)

    if args.skip_images:
        print(f"JSON écrits pour {len(names_fr)} items (images ignorées).")
        return 0

    img_dir = out_root / "img" / ITEMS_SLUG
    errors: list[str] = []
    for idx, item_id in enumerate(sorted(ids_fr)):
        url = fr_items[item_id][0]
        ext = extension_from_url(url)
        dest = img_dir / f"{item_id}{ext}"
        try:
            download_file(url, dest)
        except (urllib.error.URLError, OSError) as e:
            errors.append(f"{item_id}: {e}")
        if args.sleep > 0 and idx < len(ids_fr) - 1:
            time.sleep(args.sleep)

    if errors:
        print(f"Téléchargement terminé avec {len(errors)} erreur(s) sur {len(ids_fr)} items.")
        for line in errors[:20]:
            print(line)
        if len(errors) > 20:
            print(f"... et {len(errors) - 20} autre(s).")
        return 1

    print(f"OK : {len(ids_fr)} images dans {img_dir} et JSON dans traductions/{{fr,en}}/items.json.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
