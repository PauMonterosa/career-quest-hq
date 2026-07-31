from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "frontend" / "public" / "data" / "flight-deals.json"
ORIGINS = [x.strip().upper() for x in os.getenv("FLIGHT_ORIGINS", "BCN,GRO").split(",") if x.strip()]
DESTINATIONS = [x.strip().upper() for x in os.getenv("FLIGHT_DESTINATIONS", "LIS,OPO,PAR,ROM,MIL,BER,PRG,VIE,BUD,AMS,BRU,DUB,CPH,KRK,ATH").split(",") if x.strip()]
MAX_PRICE = float(os.getenv("FLIGHT_MAX_PRICE_EUR", "120"))
API_BASE = os.getenv("AMADEUS_API_BASE", "https://test.api.amadeus.com")


def request_json(url: str, *, data: dict[str, str] | None = None, token: str | None = None) -> dict:
    body = urllib.parse.urlencode(data).encode() if data else None
    headers = {"Accept": "application/json", "User-Agent": "CareerQuestFlightRadar/1.0"}
    if data:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=30) as response:
        return json.load(response)


def main() -> None:
    client_id, secret = os.getenv("AMADEUS_CLIENT_ID"), os.getenv("AMADEUS_CLIENT_SECRET")
    generated = datetime.now(timezone.utc).isoformat()
    feed: dict = {"generated_at": generated, "provider": "Amadeus Flight Offers Search", "configured": bool(client_id and secret), "threshold_eur": MAX_PRICE, "origins": ORIGINS, "deals": [], "errors": []}
    if not client_id or not secret:
        feed["status"] = "missing_credentials"
        feed["message"] = "Añade AMADEUS_CLIENT_ID y AMADEUS_CLIENT_SECRET como secretos del repositorio para activar precios reales diarios."
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    token = request_json(f"{API_BASE}/v1/security/oauth2/token", data={"grant_type": "client_credentials", "client_id": client_id, "client_secret": secret})["access_token"]
    departure = (date.today() + timedelta(days=21)).isoformat()
    return_date = (date.today() + timedelta(days=25)).isoformat()
    for origin in ORIGINS:
        for destination in DESTINATIONS:
            query = urllib.parse.urlencode({"originLocationCode": origin, "destinationLocationCode": destination, "departureDate": departure, "returnDate": return_date, "adults": 1, "currencyCode": "EUR", "max": 3})
            try:
                result = request_json(f"{API_BASE}/v2/shopping/flight-offers?{query}", token=token)
                for offer in result.get("data", []):
                    price = float(offer.get("price", {}).get("grandTotal", 0))
                    itinerary = offer.get("itineraries", [{}])[0]
                    segments = itinerary.get("segments", [])
                    carriers = sorted({segment.get("carrierCode", "") for segment in segments if segment.get("carrierCode")})
                    feed["deals"].append({"origin": origin, "destination": destination, "departure_date": departure, "return_date": return_date, "price_eur": price, "interesting": price <= MAX_PRICE, "carriers": carriers, "stops": max(0, len(segments) - 1), "booking_url": f"https://www.google.com/travel/flights?q=Flights%20from%20{origin}%20to%20{destination}%20on%20{departure}%20return%20{return_date}"})
            except Exception as exc:
                feed["errors"].append({"route": f"{origin}-{destination}", "error": str(exc)[:180]})
    feed["deals"] = sorted(feed["deals"], key=lambda item: item["price_eur"])[:30]
    feed["alert_count"] = sum(1 for deal in feed["deals"] if deal["interesting"])
    feed["status"] = "ok"
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
