import { ApplicationConfig, ErrorHandler, inject, Injector, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { CompteService } from './core/data/compte.service';
import { OnboardingStore } from './core/data/onboarding.store';
import { GestionnaireErreurs } from './core/firebase/gestionnaire-erreurs';
import { BUILD_APP, initialiserPlantages, PLANTAGES, VERSION_APP } from './core/firebase/plantages';
import { OpenMeteoService } from './core/data/open-meteo.service';
import { WeatherProvider } from './core/data/weather-provider';
import { ThemeService } from './shared/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular(),
    provideHttpClient(withFetch()),
    provideRouter(routes),
    // La météo du moment vient de WeatherProvider ; le service derrière se change ici seulement (PLAN §4).
    { provide: WeatherProvider, useClass: OpenMeteoService },
    // Applique le thème choisi dès le démarrage.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    // Connecte Firebase (Auth, Firestore hors ligne, Storage, App Check) en tâche de fond (PLAN §4) :
    // l'app démarre toujours, même si Firebase ne se charge pas (dégradation sans bloquer le démarrage).
    // Chargé à la demande pour garder le bundle initial léger.
    provideAppInitializer(() => {
      const injector = inject(Injector);
      import('./core/firebase/firebase.service')
        .then((m) => injector.get(m.FirebaseService).exposerPourLesTests())
        .catch((erreur) => console.error("Firebase n'a pas pu démarrer : l'app continue sans.", erreur));
    }),
    // Au lancement, un onboarding déjà fait garantit le compte anonyme en tâche de fond (reprise après un échec ou
    // un lancement hors ligne). Un compte existant garde son uid. Ne bloque jamais le démarrage.
    provideAppInitializer(() => {
      const choix = inject(OnboardingStore).lire();
      if (choix !== null) void inject(CompteService).assurerCompte(choix);
    }),
    // Les erreurs non gérées vont à Crashlytics (app native de production seulement, PLAN §4), sans position ni e-mail.
    { provide: ErrorHandler, useClass: GestionnaireErreurs },
    // Au lancement : active la collecte, pose la version et envoie les rapports restés en attente (plantage hors ligne).
    // Ne bloque ni ne fait jamais échouer le démarrage.
    provideAppInitializer(() => {
      void initialiserPlantages(inject(PLANTAGES), inject(VERSION_APP), inject(BUILD_APP));
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
