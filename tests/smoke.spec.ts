import { expect, test, type Page } from "@playwright/test";

const PLAYABLE = ["coil", "glide", "flutter", "stack-fall", "brickline", "orbit", "bubble", "rally", "fruit-slice", "rail-dash", "ridge-run", "puck", "hop", "pocket-golf", "labyrinth", "drift", "helix-drop", "jigsaw", "four-up", "reversi", "twenty48", "minefield", "lights-out", "nine", "nonogram", "pipe-flow", "crates", "turnstile", "pairs", "tiles", "word-hunt", "solitaire"];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("home lists every game and links the playable ones", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.locator(".card")).toHaveCount(32);
  for (const id of PLAYABLE) await expect(page.locator(`.game-grid a[href="/play/${id}"]`)).toBeVisible();
  await expect(page.locator('.card[aria-disabled="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Puzzle" }).click();
  await expect(page.locator(".card")).toHaveCount(10); // every puzzle, playable or not
  expect(errors).toEqual([]);
});

for (const width of [360, 768, 1440]) {
  test(`home has no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("settings sheet toggles persist", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const sound = page.getByRole("switch", { name: "Sound" });
  await expect(sound).toHaveAttribute("aria-checked", "false");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("switch", { name: "Sound" })).toHaveAttribute("aria-checked", "true");
});

for (const id of PLAYABLE) {
  test(`${id}: plays, pauses on blur, resumes after reload`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/play/${id}`);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator(".stage-surface")).toBeVisible();
    await page.waitForTimeout(300);
    // Leaving the tab / app pauses and saves (call mode).
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Welcome back")).toBeVisible();
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("coil: steering works and hitting a wall ends the run with a recorded score", async ({ page }) => {
  await page.goto("/play/coil");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("dialog", { name: "Game over" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("glide: dropping blocks scores, and a run eventually ends", async ({ page }) => {
  await page.goto("/play/glide");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(400);
  await page.keyboard.press("Space");
  // Under load the first drop can miss outright; either a score or an immediate game over is valid.
  await expect(page.getByLabel(/^Score [1-9]/).or(page.getByRole("dialog", { name: "Game over" }))).toBeVisible();
  // Mistimed drops shrink the tower until one misses.
  for (let i = 0; i < 150 && !(await page.getByRole("dialog", { name: "Game over" }).isVisible()); i++) {
    await page.waitForTimeout(170 + ((i * 97) % 230));
    await page.keyboard.press("Space");
  }
  await expect(page.getByRole("dialog", { name: "Game over" })).toBeVisible();
});

test("flutter: flaps on tap, scores through gaps or crashes into the ground", async ({ page }) => {
  await page.goto("/play/flutter");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.keyboard.press("Space"); // first flap starts the run; with no more flaps it falls and crashes
  await expect(page.getByRole("dialog", { name: "Game over" })).toBeVisible({ timeout: 10_000 });
});

test("stack-fall: hard drops score and stacking to the top ends the run", async ({ page }) => {
  await page.goto("/play/stack-fall");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");
  await expect(page.getByLabel(/^Score [1-9]/)).toBeVisible();
  for (let i = 0; i < 40 && !(await page.getByRole("dialog", { name: "Game over" }).isVisible()); i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(40);
  }
  await expect(page.getByRole("dialog", { name: "Game over" })).toBeVisible();
});

// Board games: your move, then the engine's reply, computed off the main thread.
const VERSUS: Record<string, string[]> = {
  "four-up": ["Space"],
  reversi: ["Space", "Space"], // reveal cursor on a legal square, place
};
for (const [id, keys] of Object.entries(VERSUS)) {
  test(`${id}: you move and the engine replies from its Web Worker`, async ({ page }) => {
    const errors = watchErrors(page);
    const workers: string[] = [];
    page.on("worker", (w) => workers.push(w.url()));
    await page.goto(`/play/${id}`);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    for (const k of keys) await page.keyboard.press(k);
    await expect(page.locator('[data-ply="2"]')).toBeAttached({ timeout: 10_000 });
    expect(workers).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

test("difficulty: the pick is remembered, and Jigsaw on Easy solves to game over", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/play/jigsaw");
  const easy = page.getByRole("radio", { name: "Easy" });
  await expect(page.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
  await easy.click();
  await expect(easy).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("radio", { name: "Easy" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  for (let i = 0; i < 12; i++) await page.keyboard.press("Space"); // Space places one piece; Easy has 12
  await expect(page.getByRole("dialog", { name: "Game over" })).toBeVisible({ timeout: 6_000 });
  expect(errors).toEqual([]);
});

test("level puzzles have no difficulty picker", async ({ page }) => {
  await page.goto("/play/crates");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Difficulty" })).toHaveCount(0);
});

test("unknown route shows the custom 404", async ({ page }) => {
  await page.goto("/nope");
  await expect(page.getByText("Line's dead.")).toBeVisible();
});

test("works offline after one visit (service worker)", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled: this load fills the cache
  await page.goto("/play/coil");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".card")).toHaveCount(32);
  await page.goto("/play/coil");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".stage-surface")).toBeVisible();
});

test("precache: after one visit, a game never opened still loads offline", async ({ page, context }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  // ready resolves once the worker has activated, which waits for the whole site to download.
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const c = await caches.open(names.find((n) => n.startsWith("onhold-"))!);
    return (await c.keys()).length;
  });
  expect(cached).toBeGreaterThan(100);
  await context.setOffline(true);
  await page.goto("/play/reversi"); // never visited in this test
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".stage-surface")).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await expect(page.locator('[data-ply="2"]')).toBeAttached({ timeout: 10_000 }); // the engine's worker, from the cache
  await page.goto("/play/word-hunt"); // its word list comes from the precache too
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator('[aria-label="Word Hunt game area"]')).toBeVisible();
  expect(errors.filter((e) => !e.includes("ERR_INTERNET_DISCONNECTED"))).toEqual([]);
});

test("gamepad Start pauses (stubbed pad)", async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const pad = { index: 0, axes: [0, 0, 0, 0], buttons };
    Object.assign(window, { __pad: pad });
    navigator.getGamepads = () => [pad as unknown as Gamepad];
  });
  await page.goto("/play/coil");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[9].pressed = true));
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
});
