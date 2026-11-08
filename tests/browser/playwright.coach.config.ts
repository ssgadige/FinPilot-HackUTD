import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../e2e", testMatch: "chat.spec.ts", fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3100", browserName: "chromium", channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL, trace: "retain-on-failure" },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --config tests/browser/vite.config.mts",
    cwd: process.cwd(), url: "http://127.0.0.1:3100", reuseExistingServer: !process.env.CI, timeout: 30000,
  },
});
