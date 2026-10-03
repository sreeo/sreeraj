/**
 * E2E suite for the built site (dist/). Checks what must hold for EVERY monthly design:
 * routes, content, the data-qa markup contract, navigation, layout overflow, accessibility and
 * the archive. Never compares pixels between months.
 *
 *   cd automation && npm run build:site && npm run test:e2e
 *
 * Uses system Chrome when PLAYWRIGHT_CHROME_CHANNEL is set (the host), bundled Chromium in CI.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 4329);
const channel = process.env.PLAYWRIGHT_CHROME_CHANNEL || undefined;

export default defineConfig({
  testDir: here,
  timeout: 60_000,
  // Hard cap for the whole run, so a wedged browser can never stall the redesign.
  globalTimeout: 15 * 60_000,
  // Short waits: a missing marker should fail in seconds, not hold a worker for the full test timeout.
  expect: { timeout: 5_000 },
  fullyParallel: true,
  // Capped on purpose: one worker per core can exhaust memory on the host.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(here, '../test-output/e2e-report.json') }],
  ],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    baseURL: `http://127.0.0.1:${PORT}`,
    ...(channel ? { channel } : {}),
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } }],
  webServer: {
    command: `npx serve ../dist -l ${PORT} --no-clipboard`,
    cwd: path.join(here, '..'),
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
