import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OnboardingStore } from '../../core/data/onboarding.store';

/** Les onglets ne s'ouvrent qu'une fois l'onboarding terminé ; avant, on est renvoyé vers /onboarding. */
export const onboardingTermine: CanActivateFn = () =>
  inject(OnboardingStore).lire() !== null || inject(Router).createUrlTree(['/onboarding']);

/** L'onboarding terminé ne se rouvre pas : on est renvoyé vers /conseil. */
export const onboardingAFaire: CanActivateFn = () =>
  inject(OnboardingStore).lire() === null || inject(Router).createUrlTree(['/conseil']);
