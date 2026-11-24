import { AfterViewInit, afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, input, output, signal, untracked, viewChild, WritableSignal } from '@angular/core';
import * as L from 'leaflet';
import { CatalogService } from '../../core/data/catalog.service';
import { GeoService, HORS_FRANCE } from '../../core/data/geo.service';
import type { Federation } from '../../core/data/catalog.types';
import { PositionService } from '../../core/data/position.service';
import { Milieu, SaisieSpot } from '../../core/data/spots.service';
import { ATTRIBUTION, icone, TUILES } from './carte-spots';

/** Vue de départ de la carte « Position » quand la position de l'utilisateur n'est pas connue : la France entière. */
const CENTRE_FRANCE: L.LatLngTuple = [46.6, 2.5];
const ZOOM_FRANCE = 5;
const ZOOM_COMMUNE = 13;

interface Choix<T> {
  valeur: T;
  libelle: string;
}
const CATEGORIES: Choix<1 | 2>[] = [
  { valeur: 1, libelle: '1re catégorie' },
  { valeur: 2, libelle: '2e catégorie' },
];
const MILIEUX: Choix<Milieu>[] = [
  { valeur: 'riviere', libelle: 'Rivière' },
  { valeur: 'lac', libelle: 'Lac' },
  { valeur: 'canal', libelle: 'Canal' },
];

/**
 * Le formulaire « Ajouter un spot » (US 4) : une feuille plein écran dans la page (pas d'ion-modal), comme celle du leurre (US 99).
 * Il valide la saisie et rend un spot prêt à écrire ; l'enregistrement est l'affaire de la page. Le spot est toujours privé.
 * Le département se calcule en local depuis la position touchée sur la carte (GeoService, PLAN §5) : il marche hors ligne.
 */
@Component({
  selector: 'app-spot-formulaire',
  host: { '(keydown.escape)': 'annuler.emit()' },
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: block;
    }
    .feuille {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      outline: none;
      background: var(--lr-fond);
      color: var(--lr-texte);
    }
    .barre {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: max(0px, var(--ion-safe-area-top, env(safe-area-inset-top))) 8px 0;
      border-bottom: 1px solid var(--lr-bordure);
      background: var(--lr-surface);
    }
    .barre h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
    }
    .annuler {
      min-width: 80px;
      min-height: 48px;
      padding: 0 8px;
      border: none;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 17px;
      text-align: left;
    }
    .cale {
      min-width: 80px;
    }
    form {
      flex: 1;
      overflow-y: auto;
      padding: 16px 16px max(16px, env(safe-area-inset-bottom));
    }
    .groupe {
      margin-bottom: 14px;
    }
    label,
    .etiquette {
      display: block;
      margin-bottom: 6px;
      font-size: 15px;
      font-weight: 600;
    }
    input {
      width: 100%;
      min-height: 48px;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 17px;
    }
    input[aria-invalid='true'],
    .invalide {
      outline: 2px solid var(--lr-danger);
      outline-offset: -1px;
    }
    .segments {
      display: flex;
      overflow: hidden;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-surface);
    }
    .segment {
      flex: 1;
      min-height: 48px;
      border: none;
      background: transparent;
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 16px;
    }
    .segment + .segment {
      border-left: 1px solid var(--lr-bordure);
    }
    .segment[aria-checked='true'] {
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-weight: 600;
    }
    .carte {
      height: 200px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      overflow: hidden;
    }
    .aide {
      margin: 6px 0 0;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .departement {
      margin: 8px 0 0;
      font-size: 16px;
      font-weight: 600;
    }
    .erreur {
      margin: 6px 0 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-danger);
    }
    .lien-federation {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 48px;
      margin-top: 4px;
      color: var(--lr-primaire);
      font-size: 16px;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .lien-federation svg {
      width: 16px;
      height: 16px;
      flex: none;
    }
    .sans-lien {
      margin: 6px 0 0;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .enregistrer {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 48px;
      margin-top: 16px;
      border: none;
      border-radius: 12px;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-family: inherit;
      font-size: 17px;
      font-weight: 600;
    }
    .enregistrer:disabled {
      opacity: 0.6;
    }
  `,
  template: `
    <div #dialogue tabindex="-1" class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-spot">
      <div class="barre">
        <button type="button" class="annuler" (click)="annuler.emit()">Annuler</button>
        <h2 id="titre-spot">Ajouter un spot</h2>
        <span class="cale"></span>
      </div>
      <form novalidate (submit)="enregistrer($event)">
        <div class="groupe">
          <label for="spot-nom">Nom</label>
          <input
            id="spot-nom"
            type="text"
            autocomplete="off"
            placeholder="Ex. : Pont de Cé"
            [value]="nom()"
            [attr.aria-invalid]="erreurNom() ? 'true' : null"
            [attr.aria-describedby]="erreurNom() ? 'erreur-nom' : null"
            (input)="nom.set($any($event.target).value)"
            (change)="nom.set($any($event.target).value)"
          />
          @if (erreurNom(); as message) {
            <p id="erreur-nom" class="erreur" role="alert">{{ message }}</p>
          }
        </div>
        <div class="groupe">
          <span id="etiquette-categorie" class="etiquette">Catégorie</span>
          <div class="segments" [class.invalide]="erreurCategorie()" role="radiogroup" aria-labelledby="etiquette-categorie" [attr.aria-describedby]="erreurCategorie() ? 'erreur-categorie' : null">
            @for (c of categories; track c.valeur) {
              <button
                type="button"
                role="radio"
                class="segment"
                [attr.aria-checked]="categorie() === c.valeur ? 'true' : 'false'"
                [attr.tabindex]="categorie() === c.valeur || (categorie() === null && $first) ? 0 : -1"
                (click)="categorie.set(c.valeur)"
                (keydown)="fleche($event, categories, categorie)"
              >
                {{ c.libelle }}
              </button>
            }
          </div>
          @if (erreurCategorie(); as message) {
            <p id="erreur-categorie" class="erreur" role="alert">{{ message }}</p>
          }
          @if (federation(); as f) {
            <a class="lien-federation" [href]="f.url" target="_blank" rel="noopener">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              Trouver la catégorie sur le site de la fédération
            </a>
          } @else if (federation() === null) {
            <p class="sans-lien">Pas de lien pour ce département : cherche ta fédération départementale de pêche</p>
          }
        </div>
        <div class="groupe">
          <span id="etiquette-milieu" class="etiquette">Type d'eau</span>
          <div class="segments" [class.invalide]="erreurMilieu()" role="radiogroup" aria-labelledby="etiquette-milieu" [attr.aria-describedby]="erreurMilieu() ? 'erreur-milieu' : null">
            @for (m of milieux; track m.valeur) {
              <button
                type="button"
                role="radio"
                class="segment"
                [attr.aria-checked]="milieu() === m.valeur ? 'true' : 'false'"
                [attr.tabindex]="milieu() === m.valeur || (milieu() === null && $first) ? 0 : -1"
                (click)="milieu.set(m.valeur)"
                (keydown)="fleche($event, milieux, milieu)"
              >
                {{ m.libelle }}
              </button>
            }
          </div>
          @if (erreurMilieu(); as message) {
            <p id="erreur-milieu" class="erreur" role="alert">{{ message }}</p>
          }
        </div>
        <div class="groupe">
          <span id="etiquette-position" class="etiquette">Position</span>
          <div #carte class="carte" [class.invalide]="erreurPosition()" role="region" aria-label="Position"></div>
          @if (!position()) {
            <p class="aide">Touche la carte pour placer le spot.</p>
          } @else if (departement() === horsFrance) {
            <p class="erreur" role="alert">Département introuvable : place le spot en France</p>
          } @else {
            <p class="departement" role="status">Département : {{ libelleDepartement() }}</p>
          }
          @if (erreurPosition(); as message) {
            <p class="erreur" role="alert">{{ message }}</p>
          }
        </div>
        @if (echec()) {
          <p class="erreur" role="alert">Impossible d'enregistrer le spot. Réessaie.</p>
        }
        <button type="submit" class="enregistrer" [disabled]="enCours()" [attr.aria-busy]="enCours() ? 'true' : null">Enregistrer</button>
      </form>
    </div>
  `,
})
export class SpotFormulaireComponent implements AfterViewInit {
  /** Affiche un message d'échec d'enregistrement (la page le pilote). */
  readonly echec = input(false);
  /** Un enregistrement est en cours : le bouton est désactivé pour éviter un double ajout. */
  readonly enCours = input(false);
  readonly valide = output<SaisieSpot>();
  readonly annuler = output<void>();

  private readonly geo = inject(GeoService);
  private readonly positionService = inject(PositionService);
  private readonly catalogue = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogue = viewChild.required<ElementRef<HTMLElement>>('dialogue');
  private readonly conteneur = viewChild.required<ElementRef<HTMLElement>>('carte');

  protected readonly categories = CATEGORIES;
  protected readonly milieux = MILIEUX;
  protected readonly horsFrance = HORS_FRANCE;

  protected readonly nom = signal('');
  protected readonly categorie = signal<1 | 2 | null>(null);
  protected readonly milieu = signal<Milieu | null>(null);
  protected readonly position = signal<{ lat: number; lng: number } | null>(null);
  /** Code du département de la position, ou `HORS_FRANCE` ; `null` tant qu'aucune position n'est posée. */
  protected readonly departement = computed(() => {
    const p = this.position();
    return p ? this.geo.departement({ latitude: p.lat, longitude: p.lng }) : null;
  });
  protected readonly libelleDepartement = computed(() => {
    const code = this.departement();
    if (code === null) return '';
    const nom = this.geo.nomDepartement(code);
    return nom ? `${code} ${nom}` : code;
  });

  /** Fédération du département : `undefined` tant que rien n'est à montrer (pas de position, hors de France, recherche en cours), `null` si le contenu n'en a pas. */
  protected readonly federation = signal<Federation | null | undefined>(undefined);
  /** Numéro de la dernière recherche : une réponse tardive pour un ancien département ne l'emporte jamais. */
  private rechercheEnCours = 0;

  /** Les erreurs n'apparaissent qu'après un premier essai d'enregistrement, puis suivent la saisie. */
  private readonly tente = signal(false);
  protected readonly erreurNom = computed(() => (this.tente() && this.nom().trim() === '' ? 'Donne un nom à ton spot' : null));
  protected readonly erreurCategorie = computed(() => (this.tente() && this.categorie() === null ? 'Choisis la catégorie' : null));
  protected readonly erreurMilieu = computed(() => (this.tente() && this.milieu() === null ? "Choisis le type d'eau" : null));
  protected readonly erreurPosition = computed(() => (this.tente() && this.position() === null ? 'Place le spot sur la carte' : null));

  private carte: L.Map | null = null;
  private marqueur: L.Marker | null = null;
  /** Vrai dès que l'utilisateur touche, déplace ou zoome la carte : une position GPS tardive ne la recentre plus. */
  private utilisateurABouge = false;
  private detruit = false;

  constructor() {
    afterNextRender(() => this.creerCarte());
    effect(() => {
      const departement = this.departement();
      untracked(() => void this.chercherFederation(departement));
    });
    this.destroyRef.onDestroy(() => {
      this.detruit = true;
      this.carte?.remove();
    });
  }

  ngAfterViewInit(): void {
    this.dialogue().nativeElement.focus();
  }

  /** Les flèches changent le choix d'un groupe de boutons radio et lui donnent le focus. */
  protected fleche<T>(evenement: KeyboardEvent, choix: Choix<T>[], courant: WritableSignal<T | null>): void {
    const pas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[evenement.key];
    if (pas === undefined) return;
    evenement.preventDefault();
    const index = choix.findIndex((c) => c.valeur === courant());
    const suivant = choix[(index + pas + choix.length) % choix.length];
    courant.set(suivant.valeur);
    const boutons = [...(evenement.currentTarget as HTMLElement).parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')];
    boutons[choix.indexOf(suivant)]?.focus();
  }

  protected enregistrer(evenement: Event): void {
    evenement.preventDefault();
    this.tente.set(true);
    const nom = this.nom().trim();
    const { categorie, milieu } = { categorie: this.categorie(), milieu: this.milieu() };
    const position = this.position();
    const departement = this.departement();
    if (nom === '' || categorie === null || milieu === null || position === null || departement === null || departement === HORS_FRANCE) return;
    this.valide.emit({ nom, lat: position.lat, lng: position.lng, categorie, milieu, departement });
  }

  private async chercherFederation(departement: string | null): Promise<void> {
    const rang = ++this.rechercheEnCours;
    this.federation.set(undefined);
    if (departement === null || departement === HORS_FRANCE) return;
    const federation = await this.catalogue.federation(departement);
    if (rang === this.rechercheEnCours && !this.detruit) this.federation.set(federation ?? null);
  }

  private creerCarte(): void {
    if (this.detruit) return;
    const element = this.conteneur().nativeElement;
    const carte = L.map(element, { zoomControl: false, attributionControl: false, zoomSnap: 0.5 });
    carte.setView(CENTRE_FRANCE, ZOOM_FRANCE, { animate: false });
    L.control.zoom({ zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(carte);
    L.control.attribution({ prefix: false }).addTo(carte);
    L.tileLayer(TUILES, { maxZoom: 19, crossOrigin: true, attribution: ATTRIBUTION }).addTo(carte);
    // Seule la coordonnée de l'événement Leaflet compte : jsdom n'a pas de géométrie.
    carte.on('click', (e: L.LeafletMouseEvent) => this.poser(carte, element, e.latlng));
    for (const evenement of ['pointerdown', 'wheel', 'keydown']) element.addEventListener(evenement, () => (this.utilisateurABouge = true), { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const observateur = new ResizeObserver(() => carte.invalidateSize());
      observateur.observe(element);
      this.destroyRef.onDestroy(() => observateur.disconnect());
    }
    this.carte = carte;
    void this.centrerSurPosition(carte);
  }

  /** Pose le marqueur, ou le déplace : il n'y en a jamais qu'un. La région reflète sa position (lue par les tests). */
  private poser(carte: L.Map, element: HTMLElement, lieu: L.LatLng): void {
    this.utilisateurABouge = true;
    if (this.marqueur) this.marqueur.setLatLng(lieu);
    else this.marqueur = L.marker(lieu, { icon: icone(true), title: 'Position du spot', alt: 'Position du spot' }).addTo(carte);
    element.dataset['marqueurLat'] = String(lieu.lat);
    element.dataset['marqueurLng'] = String(lieu.lng);
    this.position.set({ lat: lieu.lat, lng: lieu.lng });
  }

  /** Centre la carte sur la position de l'utilisateur quand elle est connue ; sinon elle reste sur la France. */
  private async centrerSurPosition(carte: L.Map): Promise<void> {
    const resultat = await this.positionService.positionGps();
    if (this.detruit || !resultat.disponible || this.utilisateurABouge) return;
    carte.setView([resultat.latitude, resultat.longitude], ZOOM_COMMUNE, { animate: false });
  }
}
