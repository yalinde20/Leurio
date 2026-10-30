import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'app-boite',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
  host: { class: 'ion-page' },
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Boîte</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content></ion-content>
  `,
})
export class BoitePage {}
