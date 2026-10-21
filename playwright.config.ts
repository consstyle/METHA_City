import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

/**
 * Pruebas e2e contra una compilación de producción propia (carpeta .next-e2e, puerto 3200),
 * para no interferir con `npm run dev`. WebGL funciona en Chromium sin GPU (SwiftShader).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx cross-env NEXT_DIST_DIR=.next-e2e next build && npx cross-env NEXT_DIST_DIR=.next-e2e next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /no-webgl/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
    {
      name: 'no-webgl',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] } },
      testMatch: /no-webgl/,
    },
  ],
});
