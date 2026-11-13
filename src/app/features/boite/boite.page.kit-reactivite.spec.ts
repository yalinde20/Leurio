/*
 * US 103 (suites de la revue) : la feuille du kit suit la boîte pendant qu'elle est ouverte.
 * Doubles : SOURCE_TACKLE_BOX (aucun appel Firebase) et CatalogService.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, ElementKit, TypeLeurre } from '../../core/data/catalog.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { BoitePage } from './boite.page';

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'cuiller', nom: 'Cuillère tournante' },
] as TypeLeurre[];
const KIT = [
  { typeId: 'shad', raison: 'Raison du shad.', sources: ['s'], dateVerif: '2026-11-04' },
  { typeId: 'cuiller', raison: 'Raison de la cuillère.', sources: ['s'], dateVerif: '2026-11-04' },
] as ElementKit[];

const doc = (id: string, typeId: string): DocumentLeurre => ({
  id,
  data: { typeId, tailleCm: 10, poidsG: 12, couleur: 'gardon', createdAt: 1700000000000 },
  enAttente: false,
});
const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s  ]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));

async function afficher() {
  let emettre: (d: DocumentLeurre[]) => void = () => undefined;
  let abonnements = 0;
  let changerUid: (uid: string | null) => void = () => undefined;
  const source = {
    uid: async () => 'u1',
    surUid: (ok: (uid: string | null) => void) => {
      changerUid = ok;
      ok('u1');
      return () => undefined;
    },
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => {
      emettre = ok;
      // Le premier abonnement donne tout de suite un instantané ; celui d'un autre compte attend le sien (la boîte est alors en chargement).
      if (abonnements++ === 0) ok([]);
      return () => undefined;
    },
  };
  const catalogue = { typesDeLeurres: async () => TYPES, kitDeDepart: async () => KIT };
  await TestBed.configureTestingModule({
    imports: [BoitePage],
    providers: [provideIonicAngular(), { provide: SOURCE_TACKLE_BOX, useValue: source }, { provide: CatalogService, useValue: catalogue }],
  }).compileComponents();
  const fixture = TestBed.createComponent(BoitePage);
  document.body.appendChild(fixture.nativeElement);
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await attendre();
    }
  };
  await stabiliser();
  const page = fixture.nativeElement as HTMLElement;
  [...page.querySelectorAll('button')].find((b) => compact(b.textContent) === compact('Kit de départ conseillé'))!.click();
  await stabiliser();
  const dialogue = page.querySelector<HTMLElement>('[role="dialog"]')!;
  return { dialogue, stabiliser, page, emettre: (d: DocumentLeurre[]) => emettre(d), changerUid: (u: string | null) => changerUid(u) };
}

describe('US 103 : le kit suit la boîte pendant qu\'il est ouvert', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('given le kit ouvert sur une boîte vide, when un Shad arrive dans la boîte, then la mention et le bilan se mettent à jour', async () => {
    const env = await afficher();
    expect(compact(env.dialogue.textContent)).toContain(compact('0 sur 2 dans ta boîte'));
    expect(compact(env.dialogue.textContent)).not.toContain(compact('Déjà dans ta boîte'));
    env.emettre([doc('a', 'shad')]);
    await env.stabiliser();
    const lignes = [...env.dialogue.querySelectorAll('li')];
    expect(compact(lignes[0].textContent)).toContain(compact('Déjà dans ta boîte'));
    expect(compact(lignes[1].textContent)).not.toContain(compact('Déjà dans ta boîte'));
    expect(compact(env.dialogue.textContent)).toContain(compact('1 sur 2 dans ta boîte'));
  });

  it('given le kit ouvert, when la boîte repasse en chargement (autre compte), then « Chargement du kit… » s\'affiche à la place de la liste', async () => {
    const env = await afficher();
    env.emettre([doc('a', 'shad')]);
    env.changerUid('u2');
    await env.stabiliser();
    expect(compact(env.dialogue.textContent)).toContain(compact('Chargement du kit…'));
    expect(env.dialogue.querySelectorAll('li')).toHaveLength(0);
    expect(compact(env.dialogue.textContent)).not.toContain(compact('sur 2 dans ta boîte'));
  });

  it('given une feuille ouverte, when je regarde la page derrière, then elle est inerte ; elle ne l\'est plus après « Fermer »', async () => {
    const env = await afficher();
    const contenu = env.page.querySelector('ion-content')!;
    expect(contenu.hasAttribute('inert')).toBe(true);
    [...env.dialogue.querySelectorAll('button')].find((b) => compact(b.textContent) === 'Fermer')!.click();
    await env.stabiliser();
    expect(contenu.hasAttribute('inert')).toBe(false);
  });
});
