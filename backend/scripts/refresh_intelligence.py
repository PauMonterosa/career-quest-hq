from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.official_research import fetch_official_source

TARGETS = ROOT / "backend" / "research_targets.json"
OUTPUT = ROOT / "frontend" / "public" / "data" / "intelligence.json"
MAX_DISCOVERIES_PER_TARGET = 4


def relevant_links(base_url: str, links: list[dict], keywords: list[str]) -> list[str]:
    host = urlparse(base_url).hostname
    ranked: list[tuple[int, str]] = []
    seen: set[str] = {base_url.rstrip("/")}
    for link in links:
        url = str(link.get("url") or "").split("#")[0]
        if not url.startswith(("http://", "https://")) or urlparse(url).hostname != host:
            continue
        haystack = f"{url} {link.get('label', '')}".lower()
        score = sum(keyword.lower() in haystack for keyword in keywords)
        normalized = url.rstrip("/")
        if score and normalized not in seen:
            seen.add(normalized)
            ranked.append((score, url))
    return [url for _, url in sorted(ranked, key=lambda item: (-item[0], item[1]))[:MAX_DISCOVERIES_PER_TARGET]]


def previous_hashes() -> dict[str, str]:
    if not OUTPUT.exists():
        return {}
    try:
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return {item["url"]: item.get("content_hash", "") for item in payload.get("sources", [])}
    except (ValueError, OSError, KeyError):
        return {}


def main() -> None:
    targets = json.loads(TARGETS.read_text(encoding="utf-8"))
    old_hashes = previous_hashes()
    sources: list[dict] = []
    changes: list[dict] = []
    discoveries: list[dict] = []

    for target in targets:
        try:
            root = fetch_official_source(target["url"])
            sources.append({
                "agent": target["agent"], "kind": target["kind"], "entity": target["name"],
                "url": root["final_url"], "title": root["page_title"], "status": "verified",
                "signals": root["signals"], "content_hash": root["content_hash"],
            })
            previous = old_hashes.get(root["final_url"])
            if previous and previous != root["content_hash"]:
                changes.append({
                    "agent": target["agent"], "entity": target["name"], "url": root["final_url"],
                    "message": "La página oficial cambió desde la última revisión.",
                })
            for discovered_url in relevant_links(root["final_url"], root.get("links", []), target["keywords"]):
                try:
                    page = fetch_official_source(discovered_url)
                    discoveries.append({
                        "agent": target["agent"], "kind": target["kind"], "entity": target["name"],
                        "url": page["final_url"], "title": page["page_title"],
                        "signals": page["signals"], "content_hash": page["content_hash"],
                    })
                except Exception as exc:
                    discoveries.append({
                        "agent": target["agent"], "kind": target["kind"], "entity": target["name"],
                        "url": discovered_url, "status": "error", "error": str(exc),
                    })
        except Exception as exc:
            sources.append({
                "agent": target["agent"], "kind": target["kind"], "entity": target["name"],
                "url": target["url"], "status": "error", "error": str(exc),
            })

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "targets": len(targets),
            "verified": sum(item.get("status", "verified") == "verified" for item in sources),
            "discoveries": sum("error" not in item for item in discoveries),
            "changes": len(changes),
        },
        "changes": changes,
        "discoveries": discoveries,
        "sources": sources,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["summary"]))


if __name__ == "__main__":
    main()
