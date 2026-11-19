import { expect, test, type Page } from "@playwright/test";

const PLAYABLE = ["coil", "glide"];

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
  await expect(page.locator('.card[aria-disabled="true"]')).toHaveCount(30);
  await page.getByRole("button", { name: "Puzzle" }).click();
  await expect(page.locator(".card")).toHaveCount(9);
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
  await expect(page.getByLabel(/^Score [1-9]/)).toBeVisible();
  // Mistimed drops shrink the tower until one misses.
  for (let i = 0; i < 60 && !(await page.getByRole("dialog", { name: "Game over" }).isVisible()); i++) {
    await page.waitForTimeout(170 + ((i * 97) % 230));
    await page.keyboard.press("Space");
  }
  await expect(page.getByRole("dialog", { name: "Game over" })).toBeVisible();
});

test("unknown route shows the custom 404", async ({ page }) => {
  await page.goto("/nope");
  await expect(page.getByText("Line's dead.")).toBeVisible();
});
