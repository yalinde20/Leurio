// Gestionnaire d'erreurs non gérées : journal console comme celui d'Angular, puis rapport Crashlytics sans donnée
// personnelle (US 18, critère 2). Jamais d'identifiant de compte.
import { ErrorHandler, inject, Injectable } from '@angular/core';
import { BUILD_APP, PLANTAGES, VERSION_APP } from './plantages';

const EMAIL = /[^\s@/?&=:<>()"']+(?:@|%40)[^\s@%/?&=<>()"']+\.[A-Za-z]{2,}/gi;
// Nombres qui suivent une clé de position (lat, lng, lon, latitude, longitude, bbox), en paramètre d'URL ou en JSON.
const CLE_POSITION = /\b(lat|lng|lon|latitude|longitude|bbox)(["']?\s*[:=]\s*["']?)-?\d+(?:\.\d+)?(?:(?:,|%2C)-?\d+(?:\.\d+)?)*/gi;
// Chemins Firestore ou Storage : l'identifiant de compte ne sort pas.
const CHEMIN_COMPTE = /\busers(\/|%2F)[^/%\s?&#"')]+/gi;
// Latitude ou longitude : nombre décimal à au moins 3 chiffres après la virgule, éventuellement signé.
const COORDONNEE = /-?\b\d{1,3}\.\d{3,}\b/g;

/** Remplace les adresses e-mail et les coordonnées décimales. */
export function nettoyer(texte: string): string {
  return texte
    .replace(EMAIL, '[e-mail]')
    .replace(CLE_POSITION, '$1$2[coordonnée]')
    .replace(COORDONNEE, '[coordonnée]')
    .replace(CHEMIN_COMPTE, 'users$1[uid]');
}

function texteDe(valeur: unknown): string {
  if (typeof valeur === 'string') return valeur;
  try {
    return JSON.stringify(valeur) ?? String(valeur);
  } catch {
    return String(valeur);
  }
}

@Injectable()
export class GestionnaireErreurs implements ErrorHandler {
  private readonly plantages = inject(PLANTAGES);
  private readonly version = inject(VERSION_APP);
  private readonly build = inject(BUILD_APP);

  handleError(erreur: unknown): void {
    try {
      console.error(erreur);
      const message = erreur instanceof Error ? `${erreur.name}: ${erreur.message}` : texteDe(erreur);
      const pile = erreur instanceof Error ? erreur.stack : undefined;
      void this.envoyer(nettoyer(message), pile === undefined ? undefined : nettoyer(pile));
    } catch {
      // Le signalement ne doit jamais provoquer une nouvelle erreur.
    }
  }

  private async envoyer(message: string, pile?: string): Promise<void> {
    try {
      await this.plantages.definirVersion(this.version);
      await this.plantages.definirBuild?.(this.build);
      await this.plantages.enregistrer({ message, pile });
    } catch {
      // Le signalement ne doit jamais provoquer une nouvelle erreur.
    }
  }
}
