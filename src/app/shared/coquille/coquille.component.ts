import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';

addIcons({ cloudOfflineOutline });

/** Coque des écrans (US 294) : le `router-outlet` et l'indicateur « Hors ligne », sans barre d'onglets ; le dock est dans l'écran Conseil. */
@Component({
  selector: 'app-coquille',
  imports: [IonIcon, RouterOutlet],
  templateUrl: './coquille.component.html',
  styleUrl: './coquille.component.scss',
  host: { class: 'ion-page' },
})
export class CoquilleComponent {
  // US 13 : le bandeau « Hors ligne » suit les événements réseau de la fenêtre.
  protected readonly horsLigne = signal(false);

  constructor() {
    const majReseau = () => this.horsLigne.set(navigator.onLine === false);
    majReseau();
    window.addEventListener('online', majReseau);
    window.addEventListener('offline', majReseau);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', majReseau);
      window.removeEventListener('offline', majReseau);
    });
  }
}
