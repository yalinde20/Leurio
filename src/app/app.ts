import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // Le retour du navigateur ou d'Android (détail d'un conseil → écran « Conseil ») doit toujours être suivi par le routeur.
    // Sans effet de plus au démarrage de l'app, où le routeur le fait déjà.
    inject(Router).setUpLocationChangeListener();
  }
}
