"""Outbound HTTP that can't be turned against the server's own network (SSRF).

Defences, each covered in tests.py:
- Only http/https, only common web ports, no credentials in URLs.
- Every address a hostname resolves to must be public. One private answer blocks the request.
- The connection goes to the exact IP that was checked, so DNS can't change its answer between
  the check and the connect (DNS rebinding). TLS still verifies the real hostname.
- Redirects are followed by hand, and each hop goes through all of the above again.
- Hard limits on time, response size, request body size and redirect count.
- Nothing from the incoming request (cookies, session) is ever forwarded.
"""
import http.client
import ipaddress
import socket
import ssl
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

ALLOWED_SCHEMES = {"http": 80, "https": 443}
ALLOWED_PORTS = {80, 443, 8000, 8080, 8443}
ALLOWED_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
BLOCKED_HOSTS = {"localhost", "metadata", "metadata.google.internal", "instance-data"}
BLOCKED_SUFFIXES = (".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".localdomain")
# RFC 6052 NAT64 can tunnel to IPv4 inside; Python's is_global doesn't exclude it.
NAT64 = ipaddress.ip_network("64:ff9b::/96")

TOTAL_TIMEOUT_SECONDS = 15
DNS_TIMEOUT_SECONDS = 5
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_BODY_BYTES = 1024 * 1024
MAX_REDIRECTS = 5
REDIRECT_STATUSES = {301, 302, 303, 307, 308}
USER_AGENT = "SIDEQUEST-API-Explorer/1.0"

_dns_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="dns")


class BlockedDestination(Exception):
    """The destination is not allowed. The message is safe to show the user."""


class RequestFailed(Exception):
    """The request could not be completed. The message is safe to show the user."""


def is_public_ip(address):
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    if ip.version == 6:
        if ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        elif ip.sixtofour or ip.teredo or ip in NAT64:
            return False  # These tunnel to an IPv4 address we'd otherwise have to reason about.
    return ip.is_global and not (ip.is_multicast or ip.is_reserved or ip.is_unspecified or ip.is_link_local)


def build_url(url, params=()):
    """Merge extra query parameters into a URL, keeping what's already there."""
    parts = urlsplit(url)
    query = parse_qsl(parts.query, keep_blank_values=True) + list(params)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def parse_target(url):
    """Validate everything knowable from the URL alone. Returns (scheme, host, port, path)."""
    if any(c <= " " or c == "\\" for c in url):
        raise BlockedDestination("URLs can't contain spaces, control characters or backslashes.")
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        raise BlockedDestination("That URL isn't valid.")
    scheme = parts.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise BlockedDestination("Only http:// and https:// URLs are allowed.")
    if parts.username or parts.password:
        raise BlockedDestination("URLs can't contain credentials. Use an Authorization header instead.")
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise BlockedDestination("That URL has no hostname.")
    if host in BLOCKED_HOSTS or host.endswith(BLOCKED_SUFFIXES):
        raise BlockedDestination("Internal hostnames can't be reached from here.")
    port = port or ALLOWED_SCHEMES[scheme]
    if port not in ALLOWED_PORTS:
        raise BlockedDestination(f"Port {port} isn't allowed. Use one of: {', '.join(map(str, sorted(ALLOWED_PORTS)))}.")
    path = parts.path or "/"
    if parts.query:
        path = f"{path}?{parts.query}"
    return scheme, host, port, path


def resolve_public_ip(host, port):
    """Resolve with a deadline and return one address, only if every answer is public."""
    future = _dns_pool.submit(socket.getaddrinfo, host, port, type=socket.SOCK_STREAM)
    try:
        answers = future.result(timeout=DNS_TIMEOUT_SECONDS)
    except FutureTimeout:
        raise RequestFailed("DNS lookup timed out.")
    except (socket.gaierror, UnicodeError, OSError):
        raise RequestFailed(f"Couldn't resolve {host}.")
    addresses = [answer[4][0] for answer in answers]
    if not addresses or not all(is_public_ip(address) for address in addresses):
        raise BlockedDestination("That address is private or internal, so it can't be reached from here.")
    return addresses[0]


class _PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host, port, pinned_ip, timeout):
        super().__init__(host, port, timeout=timeout)
        self.pinned_ip = pinned_ip

    def connect(self):
        self.sock = socket.create_connection((self.pinned_ip, self.port), self.timeout)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, port, pinned_ip, timeout):
        self.tls_context = ssl.create_default_context()
        super().__init__(host, port, timeout=timeout, context=self.tls_context)
        self.pinned_ip = pinned_ip

    def connect(self):
        raw = socket.create_connection((self.pinned_ip, self.port), self.timeout)
        try:
            self.sock = self.tls_context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def _read_limited(response, deadline):
    chunks, size = [], 0
    while True:
        if time.monotonic() > deadline:
            raise TimeoutError
        chunk = response.read(min(65536, MAX_RESPONSE_BYTES + 1 - size))
        if not chunk:
            return b"".join(chunks), False
        chunks.append(chunk)
        size += len(chunk)
        if size > MAX_RESPONSE_BYTES:
            return b"".join(chunks)[:MAX_RESPONSE_BYTES], True


def _perform(method, url, headers, body, deadline):
    scheme, host, port, path = parse_target(url)
    pinned_ip = resolve_public_ip(host, port)
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError
    connection_class = _PinnedHTTPSConnection if scheme == "https" else _PinnedHTTPConnection
    connection = connection_class(host, port, pinned_ip, remaining)
    try:
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        data, truncated = _read_limited(response, deadline)
        return response.status, response.reason, response.getheaders(), data, truncated
    finally:
        connection.close()


def _origin(url):
    parts = urlsplit(url)
    return parts.scheme, parts.hostname, parts.port


def _decode(data, headers):
    content_type = next((value for name, value in headers if name.lower() == "content-type"), "")
    charset = "utf-8"
    for part in content_type.split(";")[1:]:
        if part.strip().lower().startswith("charset="):
            charset = part.split("=", 1)[1].strip().strip('"')
    if b"\x00" in data[:4096]:
        return None  # Binary. Not useful as text, so it isn't shown.
    try:
        return data.decode(charset, errors="replace")
    except LookupError:
        return data.decode("utf-8", errors="replace")


SENSITIVE_ON_CROSS_ORIGIN = {"authorization", "cookie", "proxy-authorization"}


def send(method, url, headers=None, body=None):
    """Perform the request, following redirects safely. Raises BlockedDestination or RequestFailed."""
    if method not in ALLOWED_METHODS:
        raise BlockedDestination("That HTTP method isn't supported.")
    encoded_body = body.encode() if body else None
    if encoded_body and len(encoded_body) > MAX_BODY_BYTES:
        raise RequestFailed("Request bodies are limited to 1 MB.")
    # Asking for identity avoids handling a compressed response of unknown expanded size.
    current_headers = {"User-Agent": USER_AGENT, "Accept": "*/*", **(headers or {}), "Accept-Encoding": "identity"}

    started = time.monotonic()
    deadline = started + TOTAL_TIMEOUT_SECONDS
    redirects = []
    current_url, current_method, current_body = url, method, encoded_body
    try:
        for _ in range(MAX_REDIRECTS + 1):
            status, reason, response_headers, data, truncated = _perform(
                current_method, current_url, current_headers, current_body, deadline
            )
            location = next((v for k, v in response_headers if k.lower() == "location"), None)
            if status not in REDIRECT_STATUSES or not location:
                return {
                    "status": status,
                    "reason": reason,
                    "elapsed_ms": round((time.monotonic() - started) * 1000),
                    "headers": response_headers,
                    "body": _decode(data, response_headers),
                    "size": len(data),
                    "truncated": truncated,
                    "redirects": redirects,
                    "final_url": current_url,
                }
            next_url = urljoin(current_url, location)
            redirects.append({"status": status, "url": next_url})
            if _origin(next_url) != _origin(current_url):
                current_headers = {k: v for k, v in current_headers.items() if k.lower() not in SENSITIVE_ON_CROSS_ORIGIN}
            if status == 303 or (status in (301, 302) and current_method == "POST"):
                current_method, current_body = "GET", None
                current_headers = {k: v for k, v in current_headers.items() if k.lower() != "content-type"}
            current_url = next_url
        raise RequestFailed(f"Stopped after {MAX_REDIRECTS} redirects.")
    except TimeoutError:
        raise RequestFailed(f"Timed out after {TOTAL_TIMEOUT_SECONDS} seconds.")
    except ssl.SSLError:
        raise RequestFailed("TLS handshake or certificate verification failed.")
    except (OSError, http.client.HTTPException, ValueError):
        raise RequestFailed("Couldn't complete the request. The server may be down or refusing connections.")
