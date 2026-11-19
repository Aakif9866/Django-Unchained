import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  use: { baseURL: "http://localhost:4310", channel: "chrome", headless: true },
  webServer: { command: "npx serve out -l 4310 --no-request-logging", url: "http://localhost:4310", reuseExistingServer: true },
});
