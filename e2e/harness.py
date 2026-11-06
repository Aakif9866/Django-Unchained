"""Shared browser harness. Drives the real app in the system Chrome.

Run with the server up:  uvx --with playwright python e2e/smoke.py
"""
import os
import time
import uuid
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8765")
SHOTS = Path(os.environ.get("SHOTS_DIR", "/tmp/sidequest-shots"))
SHOTS.mkdir(parents=True, exist_ok=True)


class Run:
    def __init__(self, playwright, width=1440, height=900, **context_args):
        self.browser = playwright.chromium.launch(channel="chrome", headless=True)
        self.context = self.browser.new_context(viewport={"width": width, "height": height}, **context_args)
        self.context.grant_permissions(["clipboard-read", "clipboard-write"])
        self.page = self.context.new_page()
        self.problems = []
        self.passed = []
        self.page.on("console", self._on_console)
        self.page.on("pageerror", lambda e: self.problems.append(f"pageerror: {e}"))

    def _on_console(self, message):
        # Tests provoke 4xx responses on purpose. Everything else logged as an error is a real problem.
        expected = "Failed to load resource" in message.text and "status of 4" in message.text
        if message.type == "error" and not expected:
            self.problems.append(f"console: {message.text}")

    def check(self, label, condition):
        (self.passed if condition else self.problems).append(label if condition else f"FAILED: {label}")
        print(("  ok   " if condition else "  FAIL ") + label)

    def until(self, label, predicate, timeout=8.0):
        """Poll from Python. Playwright's wait_for_function uses eval, which the site's CSP refuses."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                self.check(label, True)
                return True
            self.page.wait_for_timeout(50)
        self.check(label, False)
        return False

    def goto(self, path):
        response = self.page.goto(BASE + path, wait_until="networkidle")
        return response

    def shot(self, name, full=False):
        self.page.screenshot(path=SHOTS / f"{name}.png", full_page=full)

    def register(self):
        name = f"e2e{uuid.uuid4().hex[:8]}"
        self.goto("/accounts/register/")
        self.page.fill("#id_username", name)
        self.page.fill("#id_email", f"{name}@example.com")
        self.page.fill("#id_password1", "correct-horse-battery")
        self.page.fill("#id_password2", "correct-horse-battery")
        self.page.click("main button[type=submit]")
        self.page.wait_for_url("**/dashboard/")
        return name

    def finish(self):
        self.browser.close()
        print(f"\n{len(self.passed)} passed, {len(self.problems)} problems")
        for problem in self.problems:
            print("  !!", problem)
        return not self.problems


def start():
    return sync_playwright().start()
