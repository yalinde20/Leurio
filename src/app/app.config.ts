import { ApplicationConfig, inject, Injector, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ThemeService } from './shared/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular(),
    provideRouter(routes),
    // Applique le thème choisi dès le démarrage.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Connecte Firebase (Auth, Firestore hors ligne, Storage, App Check) dès le démarrage (PLAN §4).
    // Chargé à la demande pour garder le bundle initial léger.
    provideAppInitializer(() => {
      const injector = inject(Injector);
      return import('./core/firebase/firebase.service').then((m) => injector.get(m.FirebaseService).exposerPourLesTests());
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
