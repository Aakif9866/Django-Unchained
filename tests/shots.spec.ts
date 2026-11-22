import { test } from "@playwright/test";
const OUT = "test-results/shots"; // gitignored; look at these after visual changes

/** Per game: keys pressed (≈150 ms apart) after Play, before the screenshot. "wait" just waits. */
const GAMES: Record<string, string[]> = {
  coil: ["ArrowUp", "wait", "ArrowRight", "wait"],
  glide: ["Space", "wait", "Space", "wait", "Space", "wait", "Space"],
  flutter: ["Space", "wait", "Space", "wait", "Space", "wait", "Space", "wait", "Space"],
  "stack-fall": ["ArrowLeft", "ArrowLeft", "ArrowLeft", "Space", "ArrowRight", "ArrowRight", "ArrowRight", "Space", "ArrowUp", "Space", "KeyC", "wait"],
  "brickline": ["Space", "wait", "wait", "wait", "wait", "wait", "wait"],
  "orbit": ["wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait"],
  "bubble": ["ArrowLeft", "ArrowLeft", "Space", "wait", "wait", "wait", "wait", "ArrowRight", "ArrowRight", "ArrowRight"],
  "rally": ["wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait"],
  "fruit-slice": ["wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait"],
  "rail-dash": ["wait", "wait", "ArrowLeft", "wait", "wait", "wait", "ArrowRight", "wait", "ArrowUp", "wait"],
  "ridge-run": ["wait", "wait", "ArrowRight", "wait", "wait", "wait", "wait", "wait", "wait", "wait"],
  "puck": ["ArrowUp", "ArrowUp", "ArrowUp", "wait", "wait", "wait", "wait", "wait"],
  "hop": ["ArrowUp", "wait", "ArrowUp", "wait", "ArrowUp", "wait", "ArrowUp", "wait", "wait"],
  "pocket-golf": ["ArrowUp", "ArrowUp", "ArrowUp", "wait", "Space", "wait", "wait", "wait"],
  "labyrinth": ["wait", "wait", "wait"],
  "drift": ["wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "ArrowRight", "wait"],
  "helix-drop": ["ArrowLeft", "wait", "wait", "wait", "wait", "wait", "wait"],
  "four-up": ["Space", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "ArrowLeft", "Space", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "ArrowRight", "ArrowRight"],
  solitaire: ["Space", "wait", "Space", "wait", "ArrowUp", "wait"],
  "word-hunt": ["wait", "wait", "wait", "wait"],
  tiles: ["ArrowRight", "Space", "ArrowRight", "ArrowRight", "wait"],
  pairs: ["Space", "Space", "ArrowRight", "Space", "ArrowDown", "Space", "wait"],
  turnstile: ["wait", "ArrowRight", "wait", "wait"],
  crates: ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowDown", "wait"],
  "pipe-flow": ["Space", "Space", "ArrowRight", "Space", "Space", "ArrowUp", "Space", "wait"],
  nonogram: ["Space", "Space", "ArrowRight", "Space", "ArrowRight", "KeyC", "ArrowDown", "Space", "wait"],
  nine: ["ArrowUp", "KeyN", "Digit1", "Digit2", "KeyN", "ArrowLeft", "Digit5", "wait"],
  "lights-out": ["Space", "Space", "ArrowLeft", "Space", "wait"],
  minefield: ["Space", "Space", "wait", "wait", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", "KeyC", "ArrowLeft", "wait"],
  twenty48: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "ArrowUp", "wait", "wait"],
  reversi: ["Space", "Space", "wait", "wait", "wait", "wait", "wait", "wait", "wait", "wait"],
  jigsaw: ["wait", "Space", "Space", "Space", "Space", "Space", "wait"],
};

test("home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/"); await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + "/home-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/"); await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + "/home-desktop.png" });
});

const only = process.env.SHOT; // SHOT=brickline npx playwright test tests/shots.spec.ts
for (const [id, keys] of Object.entries(GAMES)) {
  if (only && only !== id) continue;
  test(`shot ${id}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/play/${id}`);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(300);
    for (const k of keys) {
      if (k !== "wait") await page.keyboard.press(k);
      await page.waitForTimeout(150);
    }
    await page.screenshot({ path: `${OUT}/${id}.png` });
  });
}
