import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: [
    {
      // US 36 : émulateurs Firebase (projet demo-leurio, ports de firebase.json). Java requis.
      // Prêts quand la console l'annonce : Auth, Firestore et Storage n'ouvrent pas tous le même port.
      command: 'npx firebase emulators:start --only auth,firestore,storage --project demo-leurio',
      wait: { stdout: /All emulators ready/ },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npm start',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
    },
    {
      // Build de production servi en local (service worker et manifeste n'existent qu'ici).
      // US 36 : configuration émulateurs, car le build réel exige les variables FIREBASE_*.
      command: 'npm run build:emulateurs && node e2e/serve-dist.mjs dist/leurio/browser 4300',
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
