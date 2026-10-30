import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonIcon, IonTabBar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { briefcaseOutline, compassOutline, locationOutline, personOutline } from 'ionicons/icons';

addIcons({ compassOutline, briefcaseOutline, locationOutline, personOutline });

@Component({
  selector: 'app-onglets',
  imports: [IonTabBar, IonIcon, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './onglets.component.html',
  styleUrl: './onglets.component.scss',
  host: { class: 'ion-page' },
})
export class OngletsComponent {
  // Des liens `role="tab"` plutôt que des ion-tab-button : leur rôle tab est dans un shadow DOM,
  // sans le libellé, ce qui les rend illisibles pour les lecteurs d'écran et les tests.
  protected readonly onglets = [
    { chemin: '/conseil', libelle: 'Conseil', icone: 'compass-outline' },
    { chemin: '/boite', libelle: 'Boîte', icone: 'briefcase-outline' },
    { chemin: '/spots', libelle: 'Spots', icone: 'location-outline' },
    { chemin: '/compte', libelle: 'Compte', icone: 'person-outline' },
  ];
}
