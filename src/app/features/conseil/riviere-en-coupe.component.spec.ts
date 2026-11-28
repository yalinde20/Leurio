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
});
