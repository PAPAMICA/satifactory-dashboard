"""Utilitaires partagés pour parser les pages « liste » SCIM (cartes id + image + nom)."""

from __future__ import annotations

import json
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

BASE = "https://satisfactory-calculator.com"
USER_AGENT = (
    "satifactory-dashboard-fetch/1.0 (+https://github.com; respectful scrape; "
    "thumbnails from SCIM public pages)"
)


def card_pattern(slug: str) -> re.Pattern[str]:
    """slug : segment d'URL (ex. items, buildings, structures)."""
    return re.compile(
        rf'href="/(?P<lang>fr|en)/{re.escape(slug)}/detail/id/(?P<id>[^/]+)/name/[^"]*">\s*'
        r'<img src="(?P<src>[^"]+)" alt="(?P<alt>[^"]*)"',
        re.MULTILINE,
    )


def fetch(url: str, timeout: float = 120.0) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "fr,en;q=0.9"},
        method="GET",
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def parse_listing_page(html: str, lang: str, slug: str) -> dict[str, tuple[str, str]]:
    """Retourne id -> (url_image sans query, nom affiché)."""
    pat = card_pattern(slug)
    out: dict[str, tuple[str, str]] = {}
    for m in pat.finditer(html):
        if m.group("lang") != lang:
            continue
        item_id = m.group("id")
        src = m.group("src").split("?", 1)[0]
        name = m.group("alt").strip()
        out[item_id] = (src, name)
    return out


def extension_from_url(url: str) -> str:
    path = urlparse(url).path
    suf = Path(path).suffix.lower()
    return suf if suf in {".png", ".jpg", ".jpeg", ".webp", ".gif"} else ".png"


def download_file(url: str, dest: Path, timeout: float = 120.0) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT},
        method="GET",
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        dest.write_bytes(resp.read())


def write_json(path: Path, mapping: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = dict(sorted(mapping.items(), key=lambda kv: kv[0]))
    path.write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
