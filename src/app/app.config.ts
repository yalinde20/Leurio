import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideIonicAngular()],
};
