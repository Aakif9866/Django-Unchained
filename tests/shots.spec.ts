import { test } from "@playwright/test";
const OUT = "test-results/shots"; // gitignored; look at these after visual changes
test("screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/"); await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + "/home-phone.png", fullPage: true });
  await page.goto("/play/coil"); await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + "/coil-ready.png" });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(500); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + "/coil-play.png" });
  await page.goto("/play/glide"); await page.getByRole("button", { name: "Play", exact: true }).click();
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); await page.keyboard.press("Space"); }
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "/glide-play.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/"); await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + "/home-desktop.png" });
});
