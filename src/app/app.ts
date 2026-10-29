import { Component } from '@angular/core';
import { IonApp, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonHeader, IonToolbar, IonTitle, IonContent],
  templateUrl: './app.html',
})
export class App {}
