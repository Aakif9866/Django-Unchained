import http.server
import ipaddress
import socket
import threading
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from django.urls import reverse

from . import safe_http
from .models import RequestLog, SavedRequest
from .safe_http import BlockedDestination, RequestFailed, is_public_ip, parse_target

User = get_user_model()


def fake_dns(*addresses):
    """Answers every hostname with these addresses. IP literals resolve to themselves, as in real DNS."""

    def lookup(host, port, *args, **kwargs):
        try:
            ipaddress.ip_address(host)
            answers = [host]
        except ValueError:
            answers = addresses
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (a, port)) for a in answers]

    return mock.patch("socket.getaddrinfo", side_effect=lookup)


class IpClassificationTests(SimpleTestCase):
    def test_blocked_addresses(self):
        blocked = [
            "127.0.0.1", "127.8.8.8", "0.0.0.0", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1",
            "169.254.169.254",  # Cloud metadata endpoint.
            "100.64.0.1",  # Carrier-grade NAT.
            "192.0.2.1", "198.18.0.1", "224.0.0.1", "240.0.0.1", "255.255.255.255",
            "::1", "::", "fe80::1", "fc00::1", "fd00::1", "ff02::1",
            "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254",  # IPv4-mapped.
            "2002:7f00:1::",  # 6to4 wrapping 127.0.0.1.
            "64:ff9b::7f00:1",  # NAT64 wrapping 127.0.0.1.
            "2001:0:4136:e378:8000:63bf:3fff:fdd2",  # Teredo.
            "not-an-ip",
        ]
        for address in blocked:
            self.assertFalse(is_public_ip(address), address)

    def test_public_addresses_allowed(self):
        for address in ["1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"]:
            self.assertTrue(is_public_ip(address), address)


class UrlValidationTests(SimpleTestCase):
    def test_rejected_urls(self):
        rejected = [
            "ftp://example.com/", "file:///etc/passwd", "gopher://example.com/", "javascript:alert(1)",
            "http://user:pw@example.com/", "http://example.com@127.0.0.1/",
            "http://localhost/", "http://LOCALHOST/", "http://localhost./", "http://foo.localhost/",
            "http://metadata.google.internal/", "http://db.internal/", "http://printer.local/",
            "http://example.com:22/", "http://example.com:6379/", "http://example.com:99999/",
            "http://exa mple.com/", "http://example.com\\@127.0.0.1/", "http://example.com/\r\nX: y", "http:///nohost",
            "no-scheme.example.com",
        ]
        for url in rejected:
            with self.assertRaises(BlockedDestination, msg=url):
                parse_target(url)

    def test_accepted(self):
        self.assertEqual(parse_target("https://Example.com/a?b=1"), ("https", "example.com", 443, "/a?b=1"))
        self.assertEqual(parse_target("http://example.com:8080"), ("http", "example.com", 8080, "/"))


class DnsDefenceTests(SimpleTestCase):
    def blocked(self, url, *addresses):
        with fake_dns(*addresses), self.assertRaises(BlockedDestination):
            safe_http.send("GET", url)

    def test_hostname_resolving_to_private_is_blocked(self):
        self.blocked("http://sneaky.example.com/", "127.0.0.1")
        self.blocked("http://sneaky.example.com/", "169.254.169.254")

    def test_one_private_answer_among_public_ones_blocks(self):
        self.blocked("http://sneaky.example.com/", "8.8.8.8", "10.0.0.5")

    def test_numeric_host_spellings_of_loopback_are_blocked(self):
        # Real resolver: these all mean 127.0.0.1 to getaddrinfo.
        for url in ["http://127.0.0.1/", "http://2130706433/", "http://0x7f.0.0.1/", "http://0177.0.0.1/", "http://127.1/", "http://[::1]/"]:
            with self.assertRaises((BlockedDestination, RequestFailed), msg=url):
                safe_http.send("GET", url)

    def test_unresolvable_host(self):
        with mock.patch("socket.getaddrinfo", side_effect=socket.gaierror), self.assertRaises(RequestFailed):
            safe_http.send("GET", "http://nope.example.com/")

    def test_method_allowlist(self):
        with self.assertRaises(BlockedDestination):
            safe_http.send("TRACE", "http://example.com/")


class _Handler(http.server.BaseHTTPRequestHandler):
    seen = []

    def do_GET(self):
        _Handler.seen.append({"path": self.path, "headers": dict(self.headers), "method": "GET"})
        if self.path == "/json":
            self._send(200, b'{"ok": true}', {"Content-Type": "application/json; charset=utf-8", "X-Test": "yes"})
        elif self.path == "/big":
            self._send(200, b"x" * (safe_http.MAX_RESPONSE_BYTES + 5000))
        elif self.path == "/binary":
            self._send(200, b"\x00\x01\x02")
        elif self.path == "/to-json":
            self._send(302, b"", {"Location": "/json"})
        elif self.path == "/to-loop":
            self._send(302, b"", {"Location": "/to-loop"})
        elif self.path == "/to-other-host":
            self._send(302, b"", {"Location": f"http://other.example.test:{self.server.server_port}/json"})
        elif self.path == "/to-metadata":
            self._send(302, b"", {"Location": "http://169.254.169.254/latest/meta-data/"})
        elif self.path == "/to-file":
            self._send(302, b"", {"Location": "file:///etc/passwd"})
        else:
            self._send(404, b"nope")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        _Handler.seen.append({"path": self.path, "headers": dict(self.headers), "method": "POST", "body": body})
        if self.path == "/post-redirect":
            self._send(302, b"", {"Location": "/json"})
        else:
            self._send(201, body, {"Content-Type": "application/json"})

    def _send(self, status, body, headers=None):
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class RealServerTests(SimpleTestCase):
    """Runs the full client against a real socket. The public-IP check is relaxed for loopback only."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        cls.port = cls.server.server_port
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        original = safe_http.ALLOWED_PORTS
        safe_http.ALLOWED_PORTS = {*original, cls.port}
        cls.addClassCleanup(setattr, safe_http, "ALLOWED_PORTS", original)
        cls.addClassCleanup(cls.server.shutdown)

    def setUp(self):
        _Handler.seen.clear()
        self.real_is_public = is_public_ip
        patcher = mock.patch.object(safe_http, "is_public_ip", side_effect=lambda ip: ip == "127.0.0.1" or self.real_is_public(ip))
        patcher.start()
        self.addCleanup(patcher.stop)

    def url(self, path):
        return f"http://api.example.test:{self.port}{path}"

    def send(self, method, path, **kwargs):
        with fake_dns("127.0.0.1"):
            return safe_http.send(method, self.url(path), **kwargs)

    def test_round_trip_reports_status_headers_body_and_timing(self):
        result = self.send("GET", "/json", headers={"X-Mine": "1"})
        self.assertEqual(result["status"], 200)
        self.assertEqual(result["body"], '{"ok": true}')
        self.assertIn(("X-Test", "yes"), result["headers"])
        self.assertGreaterEqual(result["elapsed_ms"], 0)
        self.assertEqual(_Handler.seen[0]["headers"]["X-Mine"], "1")

    def test_host_header_keeps_the_name_while_connecting_to_the_checked_ip(self):
        self.send("GET", "/json")
        self.assertEqual(_Handler.seen[0]["headers"]["Host"], f"api.example.test:{self.port}")

    def test_dns_change_after_validation_cannot_redirect_connection(self):
        # Rebinding defence: the hostname is resolved once, and the socket opens to that checked IP.
        with fake_dns("127.0.0.1") as dns, mock.patch("socket.create_connection", wraps=socket.create_connection) as connect:
            safe_http.send("GET", self.url("/json"))
        hostname_lookups = [c for c in dns.call_args_list if c.args[0] == "api.example.test"]
        self.assertEqual(len(hostname_lookups), 1)
        self.assertEqual(connect.call_args.args[0], ("127.0.0.1", self.port))

    def test_response_size_is_capped(self):
        result = self.send("GET", "/big")
        self.assertTrue(result["truncated"])
        self.assertEqual(result["size"], safe_http.MAX_RESPONSE_BYTES)

    def test_binary_body_not_returned_as_text(self):
        self.assertIsNone(self.send("GET", "/binary")["body"])

    def test_redirect_followed_and_recorded(self):
        result = self.send("GET", "/to-json")
        self.assertEqual(result["status"], 200)
        self.assertEqual(len(result["redirects"]), 1)

    def test_redirect_to_metadata_is_blocked(self):
        with self.assertRaises(BlockedDestination):
            self.send("GET", "/to-metadata")
        self.assertEqual([s["path"] for s in _Handler.seen], ["/to-metadata"])

    def test_redirect_to_other_scheme_is_blocked(self):
        with self.assertRaises(BlockedDestination):
            self.send("GET", "/to-file")

    def test_redirect_loop_stops(self):
        with self.assertRaises(RequestFailed):
            self.send("GET", "/to-loop")
        self.assertEqual(len(_Handler.seen), safe_http.MAX_REDIRECTS + 1)

    def test_authorization_not_leaked_across_origins(self):
        self.send("GET", "/to-other-host", headers={"Authorization": "Bearer secret", "Cookie": "a=b"})
        final = _Handler.seen[-1]
        self.assertEqual(final["path"], "/json")
        self.assertNotIn("Authorization", final["headers"])
        self.assertNotIn("Cookie", final["headers"])

    def test_authorization_kept_on_same_origin_redirect(self):
        self.send("GET", "/to-json", headers={"Authorization": "Bearer secret"})
        self.assertEqual(_Handler.seen[-1]["headers"]["Authorization"], "Bearer secret")

    def test_post_body_sent_and_dropped_on_302(self):
        result = self.send("POST", "/echo", body='{"a": 1}', headers={"Content-Type": "application/json"})
        self.assertEqual((result["status"], result["body"]), (201, '{"a": 1}'))
        self.send("POST", "/post-redirect", body='{"a": 1}', headers={"Content-Type": "application/json"})
        self.assertEqual(_Handler.seen[-1]["method"], "GET")

    def test_connection_refused_is_clean_error(self):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            closed_port = probe.getsockname()[1]
        safe_http.ALLOWED_PORTS = {*safe_http.ALLOWED_PORTS, closed_port}
        with fake_dns("127.0.0.1"), self.assertRaises(RequestFailed):
            safe_http.send("GET", f"http://api.example.test:{closed_port}/")

    def test_build_url_merges_params(self):
        self.assertEqual(safe_http.build_url("http://a.test/p?x=1", [("y", "a b")]), "http://a.test/p?x=1&y=a+b")


class EndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user("ada", password="pw-for-tests-1")
        self.url = reverse("api_explorer:send")

    def post(self, **data):
        return self.client.post(self.url, {"method": "GET", "url": "http://example.com/", **data}, content_type="application/json")

    def test_loopback_blocked_through_the_real_endpoint_with_no_secrets_leaked(self):
        response = self.post(url="http://127.0.0.1:8000/admin/")
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("Traceback", response.content.decode())

    def test_metadata_blocked(self):
        self.assertEqual(self.post(url="http://169.254.169.254/latest/meta-data/").status_code, 403)

    def test_forbidden_and_malformed_headers_rejected(self):
        for headers in ([["Host", "internal"]], [["Transfer-Encoding", "chunked"]], [["Bad Name", "x"]], [["X-A", "a\r\nEvil: 1"]], "nope", [["only-one"]]):
            self.assertEqual(self.post(headers=headers).status_code, 400, headers)

    def test_csrf_enforced(self):
        from django.test import Client
        strict = Client(enforce_csrf_checks=True)
        self.assertEqual(strict.post(self.url, {}, content_type="application/json").status_code, 403)

    def test_guest_is_rate_limited(self):
        with mock.patch.object(safe_http, "send", return_value={"status": 200, "elapsed_ms": 1}):
            codes = [self.post().status_code for _ in range(11)]
        self.assertEqual(codes[:10], [200] * 10)
        self.assertEqual(codes[10], 429)

    def test_history_recorded_without_headers_and_trimmed(self):
        self.client.force_login(self.user)
        with mock.patch.object(safe_http, "send", return_value={"status": 200, "elapsed_ms": 5}):
            self.post(headers=[["Authorization", "Bearer secret"]])
        log = RequestLog.objects.get()
        self.assertEqual((log.user, log.status), (self.user, 200))
        self.assertNotIn("secret", str(vars(log)))

    def test_guest_gets_no_history(self):
        with mock.patch.object(safe_http, "send", return_value={"status": 200, "elapsed_ms": 5}):
            self.post()
        self.assertEqual(RequestLog.objects.count(), 0)
        self.assertEqual(self.client.get(reverse("api_explorer:history")).status_code, 401)

    def test_saved_requests_are_private(self):
        self.client.force_login(self.user)
        body = {"name": "Ping", "method": "GET", "url": "https://example.com/", "params": [["a", "1"]], "headers": []}
        saved = self.client.post(reverse("api_explorer:saved"), body, content_type="application/json")
        self.assertEqual(saved.status_code, 201)
        pk = saved.json()["id"]
        self.client.force_login(User.objects.create_user("eve", password="pw-for-tests-1"))
        self.assertEqual(self.client.delete(reverse("api_explorer:delete_saved", args=[pk])).status_code, 404)
        self.assertEqual(self.client.get(reverse("api_explorer:saved")).json()["saved"], [])
        self.assertTrue(SavedRequest.objects.filter(pk=pk).exists())
