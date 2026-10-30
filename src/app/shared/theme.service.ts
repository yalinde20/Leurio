import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ChoixTheme = 'systeme' | 'clair' | 'sombre';

const CLE = 'leurio.theme';

/**
 * Choix du thème (PLAN §3) : « système » (par défaut), clair ou sombre.
 * Clair et sombre posent data-theme sur <html> ; « système » le retire et les tokens suivent
 * prefers-color-scheme. Le choix est gardé dans localStorage ; une valeur illisible vaut « système ».
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly _choix = signal<ChoixTheme>(lireChoix());
  readonly choix = this._choix.asReadonly();

  /** Valeurs d'origine des balises theme-color (clair, sombre), lues dans index.html. */
  private readonly barres = this.lireBarres();

  constructor() {
    this.appliquer(this._choix());
  }

  choisir(choix: ChoixTheme): void {
    this._choix.set(choix);
    try {
      localStorage.setItem(CLE, choix);
    } catch {
      // Stockage indisponible : le choix vaut pour cette session seulement.
    }
    this.appliquer(choix);
  }

  private appliquer(choix: ChoixTheme): void {
    const racine = this.document.documentElement;
    if (choix === 'systeme') racine.removeAttribute('data-theme');
    else racine.setAttribute('data-theme', choix);

    // Barre d'état : un thème forcé impose sa couleur, « système » rend la main au téléphone.
    for (const { meta, clair, sombre } of this.barres) {
      meta.setAttribute('content', choix === 'clair' ? clair : choix === 'sombre' ? sombre : meta.dataset['origine'] ?? '');
    }
  }

  private lireBarres() {
    const metas = Array.from(this.document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const valeur = (cherche: string) =>
      metas.find((m) => (m.getAttribute('media') ?? '').includes(cherche))?.getAttribute('content') ?? '';
    const [clair, sombre] = [valeur('light'), valeur('dark')];
    return metas.map((meta) => {
      meta.dataset['origine'] = meta.getAttribute('content') ?? '';
      return { meta, clair, sombre };
    });
  }
}

function lireChoix(): ChoixTheme {
  try {
    const valeur = localStorage.getItem(CLE);
    return valeur === 'clair' || valeur === 'sombre' || valeur === 'systeme' ? valeur : 'systeme';
  } catch {
    return 'systeme';
  }
}
