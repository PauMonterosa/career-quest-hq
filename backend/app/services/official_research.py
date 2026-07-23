import hashlib
import ipaddress
import re
import socket
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse
import httpx

MAX_RESPONSE_BYTES = 2_000_000
USER_AGENT = "CareerQuestHQ/0.2 (+local user-triggered official-source verifier)"


class UnsafeSource(ValueError):
    pass


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self.skip_depth = 0
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.skip_depth:
            return
        clean = " ".join(data.split())
        if clean:
            self.parts.append(clean)
            if self.in_title:
                self.title_parts.append(clean)

    @property
    def text(self) -> str:
        return " ".join(self.parts)

    @property
    def title(self) -> str:
        return " ".join(self.title_parts)[:500]


SIGNALS = {
    "deadlines": ("deadline", "application window", "apply", "convocatòria", "fecha límite"),
    "admission": ("admission", "eligibility", "requirement", "prerequisite", "admissió", "requisit"),
    "fees_funding": ("tuition", "fee", "scholarship", "funding", "beca", "finançament"),
    "research": ("research", "project", "publication", "laboratory", "group", "recerca", "projecte"),
    "people_contact": ("professor", "supervisor", "people", "team", "contact", "investigator", "investigador"),
}


def validate_public_url(url: str, resolve_dns: bool = True) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsafeSource("Only absolute HTTP(S) official sources are allowed")
    host = parsed.hostname.lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        raise UnsafeSource("Local network sources are not allowed")
    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        addresses = []
        if resolve_dns:
            for info in socket.getaddrinfo(host, parsed.port or 443, type=socket.SOCK_STREAM):
                addresses.append(ipaddress.ip_address(info[4][0]))
    if any(address.is_private or address.is_loopback or address.is_link_local or
           address.is_multicast or address.is_reserved for address in addresses):
        raise UnsafeSource("Private or non-public network sources are not allowed")
    return url


def extract_signals(text: str) -> dict[str, list[str]]:
    compact = " ".join(text.split())
    lowered = compact.lower()
    output: dict[str, list[str]] = {}
    for category, keywords in SIGNALS.items():
        snippets: list[str] = []
        for keyword in keywords:
            start = 0
            while len(snippets) < 3:
                index = lowered.find(keyword, start)
                if index < 0:
                    break
                left = max(0, index - 100)
                right = min(len(compact), index + len(keyword) + 180)
                snippet = compact[left:right].strip(" ·-|")
                if snippet and snippet not in snippets:
                    snippets.append(snippet)
                start = index + len(keyword)
        if snippets:
            output[category] = snippets
    return output


def fetch_official_source(url: str, client: httpx.Client | None = None, resolve_dns: bool = True) -> dict[str, Any]:
    validate_public_url(url, resolve_dns=resolve_dns)
    owns_client = client is None
    active_client = client or httpx.Client(
        follow_redirects=True,
        timeout=httpx.Timeout(12.0, connect=6.0),
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    )
    try:
        with active_client.stream("GET", url) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "html" not in content_type.lower():
                raise ValueError(f"Unsupported content type: {content_type or 'unknown'}")
            chunks: list[bytes] = []
            total = 0
            for chunk in response.iter_bytes():
                total += len(chunk)
                if total > MAX_RESPONSE_BYTES:
                    raise ValueError("Official page exceeds the 2 MB research limit")
                chunks.append(chunk)
            raw = b"".join(chunks)
            encoding = response.encoding or "utf-8"
            html = raw.decode(encoding, errors="replace")
            parser = TextExtractor()
            parser.feed(html)
            return {
                "source_url": url,
                "final_url": str(response.url),
                "status_code": response.status_code,
                "page_title": parser.title,
                "content_hash": hashlib.sha256(raw).hexdigest(),
                "signals": extract_signals(parser.text),
                "text_length": len(parser.text),
            }
    finally:
        if owns_client:
            active_client.close()

