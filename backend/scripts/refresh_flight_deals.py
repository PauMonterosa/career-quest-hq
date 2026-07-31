from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, urljoin

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "frontend" / "public" / "data" / "flight-deals.json"
HISTORY = ROOT / "data" / "flight-deal-history.json"
MAX_PRICE = 120.0
HOME_TERMS = ("barcelona", "girona", "spain", "españa", "bcn", "gro")
FLIGHT_TERMS = ("flight", "flights", "airfare", "fare", "vuelo", "vuelos", "fly from", "non-stop", "direct from")
PRICE_RE = re.compile(r"(?:€\s*|EUR\s*)(\d{1,4}(?:[.,]\d{1,2})?)|(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|EUR)", re.I)
SOURCES = [
    *[{"name": f"Ryanair Fare Finder {origin}", "kind": "ryanair", "origin": origin, "url": "https://www.ryanair.com/api/farfnd/3/oneWayFares"} for origin in ("BCN", "GRO", "REU")],
    {"name": "Fly4free Spain", "kind": "rss", "url": "https://www.fly4free.com/flight-deals/spain/feed/"},
    {"name": "Fly4free Europe", "kind": "rss", "url": "https://www.fly4free.com/feed/"},
    {"name": "Vueling", "kind": "html", "url": "https://www.vueling.com/en/cheap-flights"},
    {"name": "Ryanair", "kind": "html", "url": "https://www.ryanair.com/flights/gb/en"},
]
EUROPE_CODES = {"al", "at", "be", "ba", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de", "gr", "hu", "is", "ie", "it", "lv", "lt", "lu", "mt", "md", "me", "nl", "mk", "no", "pl", "pt", "ro", "rs", "sk", "si", "es", "se", "ch", "ua", "gb"}


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 CareerQuest-SKY/1.0", "Accept": "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8"})
    with urllib.request.urlopen(request, timeout=35) as response:
        return response.read()


def clean(raw: str) -> str:
    raw = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw, flags=re.I | re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw))).strip()


def price(text: str) -> float | None:
    values = [float((a or b).replace(",", ".")) for a, b in PRICE_RE.findall(text)]
    plausible = [value for value in values if 5 <= value <= 2000]
    return min(plausible) if plausible else None


def is_flight_offer(item: dict) -> bool:
    text = f"{item.get('title', '')} {item.get('summary', '')}".lower()
    return any(term in text for term in FLIGHT_TERMS) and not any(term in text for term in ("hotel", "resort", "cruise", "package holiday", "accommodation"))


def deal(source: str, title: str, url: str, summary: str, published: str = "") -> dict:
    text = clean(f"{title} {summary}")
    amount = price(text)
    identifier = hashlib.sha1(f"{source}|{title}|{amount}".encode()).hexdigest()[:14]
    return {"id": identifier, "source": source, "title": clean(title)[:180], "summary": text[:360], "price_eur": amount, "interesting": bool(amount is not None and amount <= MAX_PRICE), "near_home": any(term in text.lower() for term in HOME_TERMS), "published": published, "source_url": url, "verification_url": f"https://www.google.com/travel/flights?q={quote(title)}"}


def parse_rss(source: dict, body: bytes) -> list[dict]:
    root = ET.fromstring(body)
    items = []
    for item in root.findall(".//item")[:40]:
        title = item.findtext("title") or "Oferta de vuelo"
        link = item.findtext("link") or source["url"]
        description = item.findtext("description") or ""
        items.append(deal(source["name"], title, link, description, item.findtext("pubDate") or ""))
    return items


def parse_html(source: dict, body: bytes) -> list[dict]:
    document = body.decode("utf-8", "ignore")
    candidates: list[dict] = []
    for match in re.finditer(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", document, re.I | re.S):
        label = clean(match.group(2))
        if len(label) < 8 or not PRICE_RE.search(label):
            continue
        candidates.append(deal(source["name"], label, urljoin(source["url"], match.group(1)), label))
    if not candidates:
        text = clean(document)
        for snippet in re.findall(r".{0,90}(?:€\s*\d+|\d+\s*€).{0,130}", text, re.I)[:20]:
            candidates.append(deal(source["name"], snippet, source["url"], snippet))
    return candidates


def parse_ryanair(source: dict) -> list[dict]:
    start, end = date.today() + timedelta(days=7), date.today() + timedelta(days=90)
    query = f"?departureAirportIataCode={source['origin']}&outboundDepartureDateFrom={start.isoformat()}&outboundDepartureDateTo={end.isoformat()}&priceValueTo={int(MAX_PRICE)}&currency=EUR"
    payload = json.loads(fetch(source["url"] + query))
    items = []
    for fare in payload.get("fares", []):
        outbound = fare.get("outbound", {})
        departure, arrival = outbound.get("departureAirport", {}), outbound.get("arrivalAirport", {})
        if arrival.get("city", {}).get("countryCode", "").lower() not in EUROPE_CODES:
            continue
        amount = float(outbound.get("price", {}).get("value", 0))
        title = f"{departure.get('iataCode')} → {arrival.get('iataCode')} · {arrival.get('name')} · {outbound.get('departureDate', '')[:16].replace('T', ' ')}"
        identifier = hashlib.sha1(f"ryanair|{outbound.get('flightKey')}|{amount}".encode()).hexdigest()[:14]
        booking = f"https://www.ryanair.com/gb/en/trip/flights/select?adults=1&teens=0&children=0&infants=0&dateOut={outbound.get('departureDate', '')[:10]}&originIata={departure.get('iataCode')}&destinationIata={arrival.get('iataCode')}&isConnectedFlight=false&isReturn=false"
        items.append({"id": identifier, "source": "Ryanair Fare Finder", "title": title, "summary": f"Vuelo {outbound.get('flightNumber', '')} desde {departure.get('name')} a {arrival.get('name')}", "price_eur": amount, "interesting": amount <= MAX_PRICE, "near_home": True, "published": generated_timestamp(), "source_url": booking, "verification_url": f"https://www.google.com/travel/flights?q={quote(title)}"})
    return items


def generated_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> None:
    generated = datetime.now(timezone.utc).isoformat()
    deals: list[dict] = []
    errors: list[dict] = []
    for source in SOURCES:
        try:
            if source["kind"] == "ryanair":
                deals.extend(parse_ryanair(source))
            else:
                body = fetch(source["url"])
                deals.extend(parse_rss(source, body) if source["kind"] == "rss" else parse_html(source, body))
        except Exception as exc:
            errors.append({"source": source["name"], "error": str(exc)[:180]})
    unique = {item["id"]: item for item in deals if item["price_eur"] is not None and is_flight_offer(item)}
    ranked = sorted(unique.values(), key=lambda item: (not item["near_home"], not item["interesting"], item["price_eur"]))[:30]
    previous = json.loads(HISTORY.read_text(encoding="utf-8")) if HISTORY.exists() else {"seen": []}
    seen = set(previous.get("seen", []))
    for item in ranked:
        item["new"] = item["id"] not in seen
    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    HISTORY.write_text(json.dumps({"updated_at": generated, "seen": list(dict.fromkeys([item["id"] for item in ranked] + list(seen)))[:500]}, indent=2), encoding="utf-8")
    feed = {"generated_at": generated, "provider": "Free public deal radar", "configured": True, "status": "ok", "threshold_eur": MAX_PRICE, "origins": ["BCN", "GRO"], "sources": [{"name": source["name"], "url": source["url"]} for source in SOURCES], "deals": ranked, "errors": errors, "alert_count": sum(1 for item in ranked if item["interesting"] and item["new"]), "message": "Radar gratuito basado en ofertas públicas; verifica siempre el precio final antes de comprar."}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
