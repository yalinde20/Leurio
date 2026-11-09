/** Le moment du conseil : jour et heure de Paris (Europe/Paris), quel que soit le fuseau de la machine. */

export type JourMoment = 'aujourdhui' | 'demain' | 'apres-demain';

export const JOURS_MOMENT: readonly { id: JourMoment; libelle: string }[] = [
  { id: 'aujourdhui', libelle: "Aujourd'hui" },
  { id: 'demain', libelle: 'Demain' },
  { id: 'apres-demain', libelle: 'Après-demain' },
];

export const HEURES_MOMENT: readonly number[] = Array.from({ length: 24 }, (_, h) => h);

/** Le conseil porte sur les 48 h à venir. */
export const FENETRE_MS = 48 * 3600 * 1000;

const JOUR_MS = 24 * 3600 * 1000;
const MOT_DU_JOUR: Record<JourMoment, string> = {
  aujourdhui: "aujourd'hui",
  demain: 'demain',
  'apres-demain': 'après-demain',
};

const murParis = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  hourCycle: 'h23',
});

/** Année, mois, jour et heure lus sur l'horloge de Paris. */
function murDeParis(date: Date): { jour: number; heure: number } {
  const parties = murParis.formatToParts(date);
  const valeur = (type: string) => Number(parties.find((p) => p.type === type)?.value);
  return {
    jour: Date.UTC(valeur('year'), valeur('month') - 1, valeur('day')) / JOUR_MS,
    heure: valeur('hour'),
  };
}

/** Écart entre l'horloge de Paris et UTC à cet instant (3 600 000 ou 7 200 000 ms). */
function decalageParis(date: Date): number {
  const { jour, heure } = murDeParis(date);
  const reste = ((date.getTime() % 3600000) + 3600000) % 3600000;
  return jour * JOUR_MS + heure * 3600000 + reste - date.getTime();
}

/** L'instant « jour choisi, heure pile » à Paris, le jour étant compté depuis le jour de Paris de `maintenant`. */
export function momentDe(jour: JourMoment, heure: number, maintenant: Date): Date {
  const decalageJours = JOURS_MOMENT.findIndex((j) => j.id === jour);
  const mur = (murDeParis(maintenant).jour + decalageJours) * JOUR_MS + heure * 3600000;
  const premier = mur - decalageParis(new Date(mur - 3600000));
  return new Date(mur - decalageParis(new Date(premier)));
}

/** Valide : strictement après `maintenant` et au plus 48 h après. */
export function momentValide(moment: Date, maintenant: Date): boolean {
  const ecart = moment.getTime() - maintenant.getTime();
  return ecart > 0 && ecart <= FENETRE_MS;
}

/** Le jour et l'heure de Paris du moment, ou `null` si le jour n'est ni aujourd'hui, ni demain, ni après-demain. */
export function jourEtHeure(moment: Date, maintenant: Date): { jour: JourMoment; heure: number } | null {
  const mur = murDeParis(moment);
  const jour = JOURS_MOMENT[mur.jour - murDeParis(maintenant).jour];
  return jour ? { jour: jour.id, heure: mur.heure } : null;
}

/** « Demain 7 h » ; la date elle-même si le jour sort de la fenêtre des trois jours. */
export function libelleMoment(moment: Date, maintenant: Date): string {
  const jh = jourEtHeure(moment, maintenant);
  if (!jh) return moment.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', hour: 'numeric' });
  const libelle = JOURS_MOMENT.find((j) => j.id === jh.jour)?.libelle ?? '';
  return `${libelle} ${jh.heure} h`;
}

/** « demain 7 h » (jour en minuscules). */
export function mentionMoment(moment: Date, maintenant: Date): string {
  return `${motDuJour(moment, maintenant)} ${murDeParis(moment).heure} h`;
}

/** « aujourd'hui », « demain » ou « après-demain ». */
export function motDuJour(moment: Date, maintenant: Date): string {
  const jh = jourEtHeure(moment, maintenant);
  return jh ? MOT_DU_JOUR[jh.jour] : "aujourd'hui";
}
