import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Identifiant provisoire : il dépendra du nom de domaine réservé pour Leurio.
  appId: 'app.leurio',
  appName: 'Leurio',
  webDir: 'dist/leurio/browser',
  experimental: {
    ios: {
      spm: {
        // Le plugin App Check (App Attest) exige un lien symbolique vers node_modules (README du plugin).
        packageOptions: {
          '@capacitor-firebase/app-check': { symlink: true },
        },
      },
    },
  },
};

export default config;
