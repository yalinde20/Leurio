import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: [
    {
      command: 'npm start',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
    },
    {
      // Build de production servi en local (service worker et manifeste n'existent qu'ici).
      command: 'npm run build && node e2e/serve-dist.mjs dist/leurio/browser 4300',
      url: 'http://localhost:4300',
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
  projects: [
    {
      name: 'dev',
      testIgnore: /\.prod\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4200' },
    },
    {
      name: 'prod',
      timeout: 90_000,
      testMatch: /.*\.prod\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4300' },
    },
  ],
});
