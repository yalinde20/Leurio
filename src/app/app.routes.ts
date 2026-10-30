import { Routes } from '@angular/router';

// Les 4 onglets ; toute autre URL (y compris la racine) ouvre le Conseil.
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shared/onglets/onglets.component').then((m) => m.OngletsComponent),
    children: [
      { path: 'conseil', loadComponent: () => import('./features/conseil/conseil.page').then((m) => m.ConseilPage) },
      { path: 'boite', loadComponent: () => import('./features/boite/boite.page').then((m) => m.BoitePage) },
      { path: 'spots', loadComponent: () => import('./features/spots/spots.page').then((m) => m.SpotsPage) },
      { path: 'compte', loadComponent: () => import('./features/compte/compte.page').then((m) => m.ComptePage) },
      { path: '', pathMatch: 'full', redirectTo: 'conseil' },
    ],
  },
  { path: '**', redirectTo: 'conseil' },
];
