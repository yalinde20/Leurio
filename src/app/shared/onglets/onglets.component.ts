import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonIcon, IonTabBar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { briefcaseOutline, cloudOfflineOutline, compassOutline, locationOutline, personOutline } from 'ionicons/icons';

addIcons({ cloudOfflineOutline, compassOutline, briefcaseOutline, locationOutline, personOutline });

@Component({
  selector: 'app-onglets',
  imports: [IonTabBar, IonIcon, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './onglets.component.html',
  styleUrl: './onglets.component.scss',
  host: { class: 'ion-page' },
})
export class OngletsComponent {
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

  // Des liens `role="tab"` plutôt que des ion-tab-button : leur rôle tab est dans un shadow DOM,
  // sans le libellé, ce qui les rend illisibles pour les lecteurs d'écran et les tests.
  protected readonly onglets = [
    { chemin: '/conseil', libelle: 'Conseil', icone: 'compass-outline' },
    { chemin: '/boite', libelle: 'Boîte', icone: 'briefcase-outline' },
    { chemin: '/spots', libelle: 'Spots', icone: 'location-outline' },
    { chemin: '/compte', libelle: 'Compte', icone: 'person-outline' },
  ];
}
