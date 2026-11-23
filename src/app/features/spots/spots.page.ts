import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, signal, untracked, viewChild } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import * as L from 'leaflet';
import { GeoService } from '../../core/data/geo.service';
import { PositionService } from '../../core/data/position.service';
import { Milieu, SpotEnregistre, SpotsService } from '../../core/data/spots.service';

/** France métropolitaine entière (Corse comprise), à l'échelle d'un pays. */
const CENTRE_FRANCE: L.LatLngTuple = [46.6, 2.5];
const ZOOM_FRANCE = 5;
/** Échelle d'une commune, pour la position de l'utilisateur ou un spot seul. */
const ZOOM_COMMUNE = 13;
/** Zoom d'un ensemble de spots quand la carte n'a pas encore de taille (page pas encore affichée). */
const ZOOM_SANS_TAILLE = 8;

const TUILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const LIBELLES_MILIEU: Record<Milieu, string> = { riviere: 'Rivière', lac: 'Lac', canal: 'Canal' };

type Etat = { type: 'chargement' } | { type: 'erreur' } | { type: 'pret'; spots: SpotEnregistre[] };

interface LigneSpot {
  spot: SpotEnregistre;
  detail: string;
}

/** Épingle : la couleur vient du token `--lr-carte-marqueur` (voir src/theme/carte.scss). */
function icone(grande: boolean): L.DivIcon {
  const [largeur, hauteur] = grande ? [40, 54] : [30, 40];
  return L.divIcon({
    className: 'marqueur-spot',
    html: '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 31s-10-11-10-18a10 10 0 0 1 20 0c0 7-10 18-10 18z"/><circle cx="12" cy="12" r="4"/></svg>',
    iconSize: [largeur, hauteur],
    iconAnchor: [largeur / 2, hauteur],
  });
}

@Component({
  selector: 'app-spots',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
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
                    </button>
                  </li>
                }
              </ul>
            }
          }
        }
        @if (etat().type !== 'chargement') {
          <!-- Le formulaire d'ajout vient avec une autre story : le bouton est affiché sans action. -->
          <button type="button" class="ajouter">Ajouter un spot</button>
        }
      </div>
    </ion-content>
  `,
})
export class SpotsPage {
  private readonly spots = inject(SpotsService);
  private readonly position = inject(PositionService);
  private readonly geo = inject(GeoService);
  private readonly conteneur = viewChild.required<ElementRef<HTMLElement>>('carte');

  protected readonly etat = signal<Etat>({ type: 'chargement' });
  protected readonly choisi = signal<string | null>(null);
  protected readonly horsLigne = signal(navigator.onLine === false);
  protected readonly lignes = computed<LigneSpot[]>(() => {
    const etat = this.etat();
    if (etat.type !== 'pret') return [];
    return [...etat.spots].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((spot) => ({ spot, detail: this.detail(spot) }));
  });

  private readonly carte = signal<L.Map | null>(null);
  private readonly marqueurs = new Map<string, L.Marker>();
  private calque: L.LayerGroup | null = null;
  /** Vrai quand le cadrage des spots a été fait sur une carte sans taille (page pas encore affichée) : à refaire à l'affichage. */
  private cadrageAReprendre = false;
  private detruit = false;

  constructor() {
    afterNextRender(() => this.creerCarte());
    inject(DestroyRef).onDestroy(() => {
      this.detruit = true;
      this.carte()?.remove();
    });
    void this.charger();
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
    if (!carte) return;
    carte.invalidateSize();
    const etat = this.etat();
    if (this.cadrageAReprendre && etat.type === 'pret') this.cadrer(carte, etat.spots);
  }

  protected choisir(spot: SpotEnregistre): void {
    this.choisi.set(spot.id);
    this.majMarqueurs();
    this.carte()?.setView([spot.lat, spot.lng], Math.max(this.carte()?.getZoom() ?? 0, ZOOM_COMMUNE));
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

  private async charger(): Promise<void> {
    try {
      this.etat.set({ type: 'pret', spots: await this.spots.mesSpots() });
    } catch {
      this.etat.set({ type: 'erreur' });
    }
  }

  private creerCarte(): void {
    if (this.detruit) return;
    const element = this.conteneur().nativeElement;
    const carte = L.map(element, { zoomControl: false, attributionControl: false }).setView(CENTRE_FRANCE, ZOOM_FRANCE);
    L.control.zoom({ zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(carte);
    L.control.attribution({ prefix: false }).addTo(carte);
    L.tileLayer(TUILES, {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a>',
    }).addTo(carte);
    // La région reflète l'état de la carte (lu par les tests, qui ne touchent pas à Leaflet).
    const reporter = () => {
      const centre = carte.getCenter();
      element.dataset['centreLat'] = String(centre.lat);
      element.dataset['centreLng'] = String(centre.lng);
      element.dataset['zoom'] = String(carte.getZoom());
    };
    carte.on('moveend', reporter);
    reporter();
    this.calque = L.layerGroup().addTo(carte);
    this.carte.set(carte);
  }

  /** Pose un marqueur par spot et cadre la carte ; sans spot, centre sur la position de l'utilisateur si elle est connue. */
  private afficher(carte: L.Map, spots: SpotEnregistre[]): void {
    this.calque?.clearLayers();
    this.marqueurs.clear();
    for (const spot of spots) {
      const marqueur = L.marker([spot.lat, spot.lng], { icon: icone(false), title: spot.nom, alt: spot.nom });
      marqueur.on('click', () => this.choisir(spot));
      this.marqueurs.set(spot.id, marqueur);
      this.calque?.addLayer(marqueur);
    }
    if (spots.length > 0) this.cadrer(carte, spots);
    else void this.centrerSurPosition(carte);
  }

  private majMarqueurs(): void {
    for (const [id, marqueur] of this.marqueurs) marqueur.setIcon(icone(id === this.choisi()));
  }

  private cadrer(carte: L.Map, spots: SpotEnregistre[]): void {
    const points = spots.map((s): L.LatLngTuple => [s.lat, s.lng]);
    const bornes = L.latLngBounds(points);
    this.cadrageAReprendre = carte.getSize().x === 0;
    if (this.cadrageAReprendre) carte.setView(bornes.getCenter(), points.length === 1 ? ZOOM_COMMUNE : ZOOM_SANS_TAILLE);
    else if (points.length === 1) carte.setView(points[0], ZOOM_COMMUNE);
    else carte.fitBounds(bornes, { padding: [40, 40], maxZoom: ZOOM_COMMUNE });
  }

  private async centrerSurPosition(carte: L.Map): Promise<void> {
    const resultat = await this.position.positionGps();
    if (this.detruit || !resultat.disponible) return;
    const lieu: L.LatLngTuple = [resultat.latitude, resultat.longitude];
    L.circleMarker(lieu, { radius: 9, className: 'ma-position', interactive: false }).addTo(this.calque ?? carte);
    carte.setView(lieu, ZOOM_COMMUNE);
  }
}
