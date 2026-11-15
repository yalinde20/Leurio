import { Routes } from '@angular/router';
import { onboardingAFaire, onboardingTermine } from './features/onboarding/onboarding.guards';

// L'onboarding (plein écran, au premier lancement), puis les 4 onglets ; toute autre URL (y compris la racine) ouvre le Conseil.
export const routes: Routes = [
  {
    path: 'onboarding',
    canActivate: [onboardingAFaire],
    loadComponent: () => import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: '',
    canActivate: [onboardingTermine],
    loadComponent: () => import('./shared/onglets/onglets.component').then((m) => m.OngletsComponent),
    children: [
      {
        path: 'conseil',
        loadComponent: () => import('./features/conseil/conseil.page').then((m) => m.ConseilPage),
        // Le détail et la fiche animation s'ouvrent dans l'écran « Conseil », qui reste vivant : son état est gardé au retour.
        children: [
          {
            path: 'detail/:rang',
            loadComponent: () => import('./features/conseil/conseil-detail.page').then((m) => m.ConseilDetailPage),
          },
          {
            path: 'detail/:rang/animation',
            loadComponent: () => import('./features/animation/animation.page').then((m) => m.AnimationPage),
          },
        ],
      },
      { path: 'boite', loadComponent: () => import('./features/boite/boite.page').then((m) => m.BoitePage) },
      { path: 'spots', loadComponent: () => import('./features/spots/spots.page').then((m) => m.SpotsPage) },
      {
        path: 'compte',
        loadComponent: () => import('./features/compte/compte.page').then((m) => m.ComptePage),
        // « Préférences », « Thème », « Consentements », « À propos et sources » et « Confidentialité » s'ouvrent dans l'écran « Compte », comme le détail dans « Conseil ».
        children: [
          { path: 'preferences', loadComponent: () => import('./features/compte/preferences.page').then((m) => m.PreferencesPage) },
          { path: 'theme', loadComponent: () => import('./features/compte/theme.page').then((m) => m.ThemePage) },
          { path: 'consentements', loadComponent: () => import('./features/compte/consentements.page').then((m) => m.ConsentementsPage) },
          { path: 'a-propos', loadComponent: () => import('./features/compte/a-propos.page').then((m) => m.AProposPage) },
          {
            path: 'confidentialite',
            loadComponent: () => import('./features/compte/confidentialite.page').then((m) => m.ConfidentialitePage),
          },
        ],
      },
      { path: '', pathMatch: 'full', redirectTo: 'conseil' },
    ],
  },
  { path: '**', redirectTo: 'conseil' },
];
