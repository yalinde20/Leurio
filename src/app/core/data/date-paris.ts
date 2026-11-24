// Sans dépendance : partagé par ConditionsService et SortieService, sans import circulaire.

/** « 27/10 à 18 h » (ou « à 18 h 30 »), à l'heure de Paris. */
export function dateEtHeureParis(date: Date): string {
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const valeur = (type: string) => parties.find((p) => p.type === type)?.value ?? '';
  const minutes = valeur('minute');
  const heure = `${Number(valeur('hour'))} h${minutes === '00' ? '' : ` ${minutes}`}`;
  return `${valeur('day')}/${valeur('month')} à ${heure}`;
}
