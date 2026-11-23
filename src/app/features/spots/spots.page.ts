import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, signal, untracked, viewChild } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import * as L from 'leaflet';
import { CatalogService } from '../../core/data/catalog.service';
import type { Federation } from '../../core/data/catalog.types';
import { GeoService } from '../../core/data/geo.service';
import { PositionService } from '../../core/data/position.service';
import { Milieu, SaisieSpot, SpotEnregistre, SpotsService } from '../../core/data/spots.service';
import { ATTRIBUTION, icone, TUILES } from './carte-spots';
import { SpotFormulaireComponent } from './spot-formulaire.component';

/** France métropolitaine entière (Corse comprise), à l'échelle d'un pays. */
const BORNES_FRANCE: L.LatLngBoundsLiteral = [
  [41.3, -5.2],
  [51.1, 9.6],
];
/** Repli sans taille de carte (page pas encore affichée) : le centre de ces bornes et un zoom de pays. */
const CENTRE_FRANCE: L.LatLngTuple = [46.6, 2.5];
const ZOOM_FRANCE = 5;
/** Échelle d'une commune, pour la position de l'utilisateur ou un spot seul. */
const ZOOM_COMMUNE = 13;
/** Zoom d'un ensemble de spots quand la carte n'a pas encore de taille (page pas encore affichée). */
const ZOOM_SANS_TAILLE = 8;

const LIBELLES_MILIEU: Record<Milieu, string> = { riviere: 'Rivière', lac: 'Lac', canal: 'Canal' };

type Etat = { type: 'chargement' } | { type: 'erreur' } | { type: 'pret'; spots: SpotEnregistre[] };

interface LigneSpot {
  spot: SpotEnregistre;
  detail: string;
}

@Component({
  selector: 'app-spots',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, SpotFormulaireComponent],
  host: { class: 'ion-page' },
  styles: `
    .contenu {
      padding: 16px;
    }
    .bloc-carte {
      position: relative;
    }
    .carte {
      height: 240px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      overflow: hidden;
    }
    .hors-ligne {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 1000;
      margin: 0;
      padding: 6px 10px;
      border: 1px solid var(--lr-bordure);
      border-radius: 8px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      font-size: 14px;
      font-weight: 600;
    }
    h2 {
      margin: 20px 0 8px;
      font-size: 20px;
      font-weight: 700;
    }
    .liste {
      margin: 0;
      padding: 0;
      list-style: none;
      overflow: hidden;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
    }
    .liste li + li {
      border-top: 1px solid var(--lr-bordure);
    }
    .spot {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 2px;
      width: 100%;
      min-height: 56px;
      padding: 8px 16px;
      border: none;
      background: transparent;
      color: var(--lr-texte);
      font: inherit;
      text-align: left;
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
    .attente {
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .nom {
      font-size: 17px;
      font-weight: 600;
    }
    .detail {
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .spot.choisi .nom {
      color: var(--lr-primaire);
      font-weight: 700;
    }
    .message {
      margin: 0;
      min-height: 48px;
      display: flex;
      align-items: center;
      font-size: 16px;
      color: var(--lr-texte-secondaire);
    }
    .ajouter {
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
      font: inherit;
      font-size: 17px;
      font-weight: 600;
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Spots</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="contenu">
        <div class="bloc-carte">
          <div #carte class="carte" role="region" aria-label="Carte des spots"></div>
          @if (horsLigne()) {
            <p class="hors-ligne" role="status">Hors ligne : carte incomplète</p>
          }
        </div>
        <h2>Mes spots</h2>
        @switch (etat().type) {
          @case ('chargement') {
            <p class="message">Chargement des spots…</p>
          }
          @case ('erreur') {
            <p class="message">Tes spots ne sont pas disponibles pour le moment.</p>
          }
          @default {
            @if (lignes().length === 0) {
              <p class="message">Aucun spot pour l'instant</p>
            } @else {
              <ul class="liste">
                @for (ligne of lignes(); track ligne.spot.id) {
                  <li>
                    <button type="button" class="spot" [class.choisi]="ligne.spot.id === choisi()" [attr.aria-current]="ligne.spot.id === choisi() ? 'true' : null" (click)="choisir(ligne.spot)">
                      <span class="nom">{{ ligne.spot.nom }}</span>&ngsp;<span class="detail">{{ ligne.detail }}</span>
                      @if (ligne.spot.enAttente) {
                        <span class="attente">Pas encore synchronisé : il le sera au retour du réseau.</span>
                      }
                    </button>
                    @if (ligne.spot.id === choisi() && federationChoisie(); as f) {
                      <a class="lien-federation" [href]="f.url" target="_blank" rel="noopener">
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                        Site de la fédération
                      </a>
                    }
                  </li>
                }
              </ul>
            }
          }
        }
        @if (etat().type !== 'chargement') {
          <button #ajouter type="button" class="ajouter" (click)="ouvrirFormulaire()">Ajouter un spot</button>
        }
      </div>
    </ion-content>
    @if (formulaireOuvert()) {
      <app-spot-formulaire [echec]="echec()" [enCours]="enCours()" (valide)="enregistrer($event)" (annuler)="fermerFormulaire()" />
    }
  `,
})
export class SpotsPage {
  private readonly spots = inject(SpotsService);
  private readonly position = inject(PositionService);
  private readonly geo = inject(GeoService);
  private readonly catalogue = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly conteneur = viewChild.required<ElementRef<HTMLElement>>('carte');
  private readonly boutonAjouter = viewChild<ElementRef<HTMLElement>>('ajouter');

  protected readonly etat = signal<Etat>({ type: 'chargement' });
  protected readonly choisi = signal<string | null>(null);
  /** Fédération du département du spot choisi ; `undefined` tant que la recherche court ou si le contenu n'en a pas. */
  protected readonly federationChoisie = signal<Federation | undefined>(undefined);
  protected readonly horsLigne = signal(navigator.onLine === false);
  protected readonly formulaireOuvert = signal(false);
  protected readonly echec = signal(false);
  protected readonly enCours = signal(false);
  protected readonly lignes = computed<LigneSpot[]>(() => {
    const etat = this.etat();
    if (etat.type !== 'pret') return [];
    return [...etat.spots].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((spot) => ({ spot, detail: this.detail(spot) }));
  });

  /** Numéro de la dernière recherche : une réponse tardive pour un spot déjà quitté ne l'emporte jamais. */
  private rechercheFederation = 0;
  private readonly carte = signal<L.Map | null>(null);
  private readonly marqueurs = new Map<string, L.Marker>();
  private calque: L.LayerGroup | null = null;
  /** Vrai quand le cadrage des spots a été fait sur une carte sans taille (page pas encore affichée) : à refaire à l'affichage. */
  private cadrageAReprendre = false;
  /** Vrai quand la vue France entière a été posée sur une carte sans taille : à refaire à l'affichage. */
  private franceAReprendre = false;
  /** Vrai dès que l'utilisateur déplace ou zoome la carte : une position GPS tardive ne la recentre plus. */
  private utilisateurABouge = false;
  /** Les spots dont la carte montre les marqueurs (identité, nom, position) : `null` tant que rien n'est affiché. */
  private spotsAffiches: string | null = null;
  private detruit = false;

  constructor() {
    afterNextRender(() => this.creerCarte());
    const arreterEcoute = this.spots.ecouter(
      (spots) => this.etat.set({ type: 'pret', spots }),
      () => this.etat.set({ type: 'erreur' }),
    );
    this.destroyRef.onDestroy(() => {
      this.detruit = true;
      arreterEcoute();
      this.carte()?.remove();
    });
    effect(() => {
      const carte = this.carte();
      const etat = this.etat();
      if (carte && etat.type !== 'chargement') untracked(() => this.afficher(carte, etat.type === 'pret' ? etat.spots : []));
    });
  }

  @HostListener('window:online')
  @HostListener('window:offline')
  protected majConnexion(): void {
    this.horsLigne.set(navigator.onLine === false);
  }

  /** Appelé par Ionic quand l'onglet devient visible : la carte a pu être créée sans taille. */
  ionViewDidEnter(): void {
    const carte = this.carte();
    if (carte) this.redimensionner(carte);
  }

  private redimensionner(carte: L.Map): void {
    carte.invalidateSize();
    const etat = this.etat();
    if (this.cadrageAReprendre && etat.type === 'pret') this.cadrer(carte, etat.spots);
    else if (this.franceAReprendre && !this.utilisateurABouge) this.cadrerFrance(carte);
  }

  protected choisir(spot: SpotEnregistre): void {
    this.choisi.set(spot.id);
    void this.chercherFederation(spot);
    // Le choix de l'utilisateur l'emporte sur un cadrage différé (l'onglet peut finir de s'afficher après le tap).
    this.cadrageAReprendre = false;
    this.majMarqueurs();
    this.carte()?.setView([spot.lat, spot.lng], Math.max(this.carte()?.getZoom() ?? 0, ZOOM_COMMUNE));
  }

  private async chercherFederation(spot: SpotEnregistre): Promise<void> {
    const rang = ++this.rechercheFederation;
    this.federationChoisie.set(undefined);
    const federation = await this.catalogue.federation(spot.departement);
    if (rang === this.rechercheFederation && !this.detruit) this.federationChoisie.set(federation);
  }

  private detail(spot: SpotEnregistre): string {
    const nom = this.geo.nomDepartement(spot.departement);
    return [
      spot.categorie === 1 ? '1re catégorie' : '2e catégorie',
      spot.milieu ? LIBELLES_MILIEU[spot.milieu] : null,
      nom ? `${nom} (${spot.departement})` : `Département ${spot.departement}`,
    ]
      .filter((p) => p !== null)
      .join(' · ');
  }

  protected ouvrirFormulaire(): void {
    this.echec.set(false);
    this.formulaireOuvert.set(true);
  }

  protected fermerFormulaire(): void {
    this.formulaireOuvert.set(false);
    // La feuille emporte le focus en se fermant : « Ajouter un spot » le reprend.
    queueMicrotask(() => this.boutonAjouter()?.nativeElement.focus());
  }

  /** Résout dès l'écriture locale : la liste et la carte se mettent à jour par l'écoute, pas par un état local. */
  protected async enregistrer(saisie: SaisieSpot): Promise<void> {
    if (this.enCours()) return;
    this.enCours.set(true);
    this.echec.set(false);
    try {
      await this.spots.ajouter(saisie);
      this.fermerFormulaire();
    } catch {
      this.echec.set(true);
    } finally {
      this.enCours.set(false);
    }
  }

  private creerCarte(): void {
    if (this.detruit) return;
    const element = this.conteneur().nativeElement;
    const carte = L.map(element, { zoomControl: false, attributionControl: false, zoomSnap: 0.5 });
    this.cadrerFrance(carte);
    L.control.zoom({ zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(carte);
    L.control.attribution({ prefix: false }).addTo(carte);
    L.tileLayer(TUILES, {
      maxZoom: 19,
      crossOrigin: true,
      attribution: ATTRIBUTION,
    }).addTo(carte);
    // La région reflète l'état de la carte (lu par les tests, qui ne touchent pas à Leaflet).
    const reporter = () => {
      const centre = carte.getCenter();
      element.dataset['centreLat'] = String(centre.lat);
      element.dataset['centreLng'] = String(centre.lng);
      element.dataset['zoom'] = String(carte.getZoom());
      const b = carte.getBounds();
      element.dataset['bornes'] = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].join(',');
    };
    carte.on('moveend', reporter);
    reporter();
    // Toute action de l'utilisateur sur la carte (glisser, boutons de zoom, molette, clavier) la lui laisse.
    for (const evenement of ['pointerdown', 'wheel', 'keydown']) element.addEventListener(evenement, () => (this.utilisateurABouge = true), { passive: true });
    this.calque = L.layerGroup().addTo(carte);
    // La page peut être créée avant d'être affichée (onglet en transition) : Leaflet garde alors une taille nulle.
    if (typeof ResizeObserver !== 'undefined') {
      const observateur = new ResizeObserver(() => this.redimensionner(carte));
      observateur.observe(element);
      this.destroyRef.onDestroy(() => observateur.disconnect());
    }
    this.carte.set(carte);
  }

  /** Pose un marqueur par spot et cadre la carte ; sans spot, centre sur la position de l'utilisateur si elle est connue. */
  private afficher(carte: L.Map, spots: SpotEnregistre[]): void {
    // L'écoute renvoie la liste à chaque confirmation du serveur : sans changement de spot, les marqueurs et le cadrage restent tels quels.
    const cle = JSON.stringify(spots.map((s) => [s.id, s.nom, s.lat, s.lng]));
    if (cle === this.spotsAffiches) return;
    this.spotsAffiches = cle;
    this.calque?.clearLayers();
    this.marqueurs.clear();
    for (const spot of spots) {
      const marqueur = L.marker([spot.lat, spot.lng], { icon: icone(false), title: spot.nom, alt: spot.nom });
      marqueur.on('click', () => this.choisir(spot));
      this.marqueurs.set(spot.id, marqueur);
      this.calque?.addLayer(marqueur);
    }
    this.majMarqueurs();
    // Un spot déjà touché dans la liste (avant la pose des marqueurs) garde le centrage demandé.
    if (spots.length > 0) {
      if (this.choisi() === null) this.cadrer(carte, spots);
    } else void this.centrerSurPosition(carte);
  }

  private majMarqueurs(): void {
    for (const [id, marqueur] of this.marqueurs) marqueur.setIcon(icone(id === this.choisi()));
  }

  private cadrer(carte: L.Map, spots: SpotEnregistre[]): void {
    const points = spots.map((s): L.LatLngTuple => [s.lat, s.lng]);
    const bornes = L.latLngBounds(points);
    this.franceAReprendre = false;
    this.cadrageAReprendre = carte.getSize().x === 0;
    // Cadrage initial sans animation : un zoom animé en cours ignorerait le centrage demandé par un tap sur la liste.
    const sansAnimation = { animate: false };
    if (this.cadrageAReprendre) carte.setView(bornes.getCenter(), points.length === 1 ? ZOOM_COMMUNE : ZOOM_SANS_TAILLE, sansAnimation);
    else if (points.length === 1) carte.setView(points[0], ZOOM_COMMUNE, sansAnimation);
    else carte.fitBounds(bornes, { padding: [40, 40], maxZoom: ZOOM_COMMUNE, ...sansAnimation });
  }

  /** France métropolitaine entière (Corse comprise) ; sans taille de carte, repli sur un centre et un zoom de pays. */
  private cadrerFrance(carte: L.Map): void {
    this.franceAReprendre = carte.getSize().x === 0;
    if (this.franceAReprendre) carte.setView(CENTRE_FRANCE, ZOOM_FRANCE, { animate: false });
    else carte.fitBounds(BORNES_FRANCE, { animate: false });
  }

  private async centrerSurPosition(carte: L.Map): Promise<void> {
    const resultat = await this.position.positionGps();
    if (this.detruit || !resultat.disponible || this.utilisateurABouge) return;
    this.franceAReprendre = false;
    const lieu: L.LatLngTuple = [resultat.latitude, resultat.longitude];
    L.circleMarker(lieu, { radius: 9, className: 'ma-position', interactive: false }).addTo(this.calque ?? carte);
    carte.setView(lieu, ZOOM_COMMUNE, { animate: false });
  }
}
