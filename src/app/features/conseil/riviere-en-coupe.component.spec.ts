/*
 * US 295 : la rivière en coupe. Le composant ne connaît pas le contenu : il reçoit des coups avec leur zone de nage (lue dans
 * lure-types.json par la page) et les pose dans la zone « Surface », « Mi-eau » ou « Fond ».
 */
import { TestBed } from '@angular/core/testing';
import { CoupRiviere, RiviereEnCoupeComponent, VueRiviere } from './riviere-en-coupe.component';

const coup = (rang: number, zone: CoupRiviere['zone'], surcharge: Partial<CoupRiviere> = {}): CoupRiviere => ({
  rang,
  type: `Type ${rang}`,
  animation: `Animation ${rang}`,
  couleur: 'Gardon',
  taille: '8 cm',
  zone,
  famille: null,
  boite: null,
  ...surcharge,
});

async function afficher(vue: VueRiviere, moinsPrecis = false) {
  await TestBed.configureTestingModule({ imports: [RiviereEnCoupeComponent] }).compileComponents();
  const fixture = TestBed.createComponent(RiviereEnCoupeComponent);
  fixture.componentRef.setInput('vue', vue);
  fixture.componentRef.setInput('moinsPrecis', moinsPrecis);
  fixture.detectChanges();
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  const zone = (nom: string) => page.querySelector<HTMLElement>(`[role="group"][aria-label="${nom}"]`)!;
  return { fixture, page, zone };
}

describe('RiviereEnCoupeComponent (US 295)', () => {
  it.each([
    ['surface', 'Surface'],
    ['mi-eau', 'Mi-eau'],
    ['fond', 'Fond'],
  ] as const)('given un coup de zone « %s », when la rivière s\'affiche, then le coup 01 est dans la zone « %s » et dans aucune autre', async (zone, nom) => {
    const env = await afficher({ type: 'coups', coups: [coup(1, zone), coup(2, 'fond'), coup(3, 'surface')], explications: [] });

    expect(env.zone(nom).querySelector('a.coup')?.textContent).toContain('01');
    for (const autre of ['Surface', 'Mi-eau', 'Fond'].filter((n) => n !== nom)) expect(env.zone(autre).querySelector('a.coup'), autre).toBeNull();
  });

  it('given la rivière, when elle s\'affiche, then les zones sont Surface, Mi-eau et Fond de haut en bas', async () => {
    const env = await afficher({ type: 'message', texte: 'Calcul du conseil…' });

    expect([...env.page.querySelectorAll('[role="group"]')].map((g) => g.getAttribute('aria-label'))).toEqual(['Surface', 'Mi-eau', 'Fond']);
  });

  it('given un seul coup, when la rivière s\'affiche, then il n\'y a pas de « 2 autres coups »', async () => {
    const env = await afficher({ type: 'coups', coups: [coup(1, 'fond')], explications: [] });

    expect(env.page.querySelector('#autres-coups')).toBeNull();
  });

  it('given trois coups, when je touche « 2 autres coups », then la feuille liste les coups 02 et 03 avec leur avis', async () => {
    const env = await afficher({ type: 'coups', coups: [coup(1, 'fond'), coup(2, 'surface'), coup(3, 'mi-eau')], explications: ['Brochet fermé : leurres écartés.'] });

    env.page.querySelector<HTMLElement>('#autres-coups')!.click();
    env.fixture.detectChanges();

    const feuille = env.page.querySelector('[role="dialog"]')!;
    expect(feuille.getAttribute('aria-label')).toBe('2 autres coups');
    expect([...feuille.querySelectorAll('a.coup .num')].map((n) => n.textContent)).toEqual(['02', '03']);
    expect(feuille.querySelectorAll('app-avis-coup')).toHaveLength(2);
    expect(feuille.querySelector('[role="note"]')?.textContent).toContain('Brochet fermé');
  });

  it('given un coup en zone « surface » et « moins précis », when la rivière s\'affiche, then le badge est posé dans cette zone', async () => {
    const env = await afficher({ type: 'coups', coups: [coup(1, 'surface')], explications: [] }, true);

    expect(env.zone('Surface').textContent).toContain('Conseil moins précis');
    expect(env.zone('Fond').textContent).not.toContain('Conseil moins précis');
  });

  it('given un moment hors des heures légales, when la rivière s\'affiche, then une alerte remplace les coups, avec « à vérifier dans l\'arrêté de ton département »', async () => {
    const env = await afficher({ type: 'hors heures', titre: 'Hors des heures légales : pas de pêche aux carnassiers la nuit.', heures: 'Heures légales demain : 7 h 54 – 17 h 44' });

    const alerte = env.page.querySelector('[role="alert"]')!;
    expect(alerte.textContent).toContain('Hors des heures légales');
    expect(alerte.textContent).toContain("À vérifier dans l'arrêté de ton département");
    expect(env.page.querySelector('a')).toBeNull();
  });

  it('given un coup avec « Dans ta boîte », when la rivière s\'affiche, then le statut est dans le lien du coup', async () => {
    const env = await afficher({ type: 'coups', coups: [coup(1, 'fond', { boite: { manque: false, texte: 'Dans ta boîte' } })], explications: [] });

    expect(env.page.querySelector('a.coup')?.textContent).toContain('Dans ta boîte');
  });

  it('given aucun conseil et des leurres écartés, when la rivière s\'affiche, then la note est dans la rivière sous le message', async () => {
    const env = await afficher({ type: 'message', texte: 'Aucun conseil pour cette espèce en ce moment.', explications: ['Brochet fermé : leurres écartés.'] });

    const zone = env.zone('Mi-eau');
    expect(zone.querySelector('.message')?.textContent).toContain('Aucun conseil');
    expect(zone.querySelector('[role="note"]')?.textContent).toContain('Brochet fermé');
  });

  it('given un seul coup et des leurres écartés (pas de feuille), when la rivière s\'affiche, then la note est sous le coup 01', async () => {
    const env = await afficher({ type: 'coups', coups: [coup(1, 'fond')], explications: ['Brochet fermé : leurres écartés.'] });

    expect(env.page.querySelector('#autres-coups')).toBeNull();
    expect(env.zone('Fond').querySelector('[role="note"]')?.textContent).toContain('Brochet fermé');
  });

  it('given un coup en zone « fond », when la rivière s\'affiche, then seule cette zone porte le contenu et les autres sont réduites à leur nom', async () => {
    const env = await afficher({ type: 'coups', coups: [coup(1, 'fond')], explications: [] });

    expect([...env.page.querySelectorAll('.zone')].map((z) => z.classList.contains('avec-contenu'))).toEqual([false, false, true]);
  });

  it('given une fédération connue, when la rivière est hors des heures légales, then l\'alerte porte son lien (nom ↗, nouvel onglet)', async () => {
    const env = await afficher({
      type: 'hors heures',
      titre: 'Hors des heures légales : pas de pêche aux carnassiers la nuit.',
      heures: 'Heures légales demain : 7 h 54 – 17 h 44',
      federation: { nom: 'Fédération de pêche de Maine-et-Loire', url: 'https://www.federation-peche49.fr' },
    });

    const liens = env.page.querySelectorAll('a');
    expect(liens).toHaveLength(1);
    expect(env.page.querySelector('[role="alert"]')?.contains(liens[0])).toBe(true);
    expect(liens[0].textContent?.trim()).toBe('Fédération de pêche de Maine-et-Loire ↗');
    expect(liens[0].getAttribute('href')).toBe('https://www.federation-peche49.fr');
    expect(liens[0].getAttribute('target')).toBe('_blank');
    expect(liens[0].getAttribute('rel')).toContain('noopener');
  });

  it('given aucune fédération connue, when la rivière est hors des heures légales, then l\'alerte n\'a aucun lien', async () => {
    const env = await afficher({ type: 'hors heures', titre: 'Hors des heures légales.', heures: 'Heures légales demain : 7 h 54 – 17 h 44' });

    expect(env.page.querySelector('a')).toBeNull();
  });
});
