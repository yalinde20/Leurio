import { afterNextRender, Component, computed, effect, ElementRef, inject, Injector, OnInit, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService, Espece, Federation } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { OnboardingStore } from '../../core/data/onboarding.store';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SpotEnregistre, SpotsService } from '../../core/data/spots.service';
import { SaisieTempEauStore } from '../../core/data/saisie-temp-eau.store';
import { SaisieTempEau } from '../../core/engine/temperature-eau';
import { dansHeuresLegales, HeuresLegales, heuresLegales } from '../../core/regulation/legal-hours';
import { libelleTailleMinimale, tailleMinimale } from '../../core/regulation/sizes';
import { BandeauReglementationComponent } from './bandeau-reglementation.component';
import { EtatSpots, LieuFeuilleComponent } from './lieu-feuille.component';
import { MomentFeuilleComponent } from './moment-feuille.component';
import {
  formaterCiel,
  formaterDebit,
  formaterHeure,
  formaterHeuresLegales,
  formaterPression,
  formaterSourceTempEau,
  formaterTempEau,
  formaterVent,
} from './conditions-format';
import { ConseilDetailStore } from './conseil-detail.store';
import { detailDuConseil, formaterTaille, libelleTaille, lireTempSaisie, premierePhrase } from './conseil-format';
import { ChoixEspece, EspeceFeuilleComponent } from './espece-feuille.component';
import {
  JourMoment,
  jourEtHeure,
  libelleMoment,
  mentionMoment,
  motDuJour,
} from './moment-format';

const TOUTES = 'Toutes les espèces';
const UNE_HEURE_MS = 3600 * 1000;

/** Le moment affiché ; `null` = « Maintenant ». Le libellé et la mention sont figés au choix. */
interface MomentChoisi {
  date: Date;
  libelle: string;
  mention: string;
}

/** Le lieu du conseil, avec le spot dont il vient (`null` = position GPS) : les deux vont ensemble. */
interface Lieu {
  latitude: number;
  longitude: number;
  spot: SpotEnregistre | null;
}

/** Ce que le choix d'une espèce relance : le relevé du moment affiché, tant que la pêche y est légale. */
interface ConseilRelancable {
  releve: ReleveActuel;
  moment: Date;
  limite: string | null;
}

/** Ce que la carte « Conditions » affiche, déjà formaté. */
interface CarteConditions {
  mention?: string;
  prevision?: string;
  moinsPrecis: boolean;
  eau: string;
  eauInconnue: boolean;
  sourceEau: string | null;
  debit: string;
  pression: string;
  ciel: string;
  vent: string;
  lune: string;
  heuresLegales: string;
  federation?: Federation;
  date: Date;
  /** Catégorie du spot du relevé affiché ; `null` pour la position GPS. */
  categorie: 1 | 2 | null;
}

/** Une carte de conseil, déjà traduite en noms et formatée. */
interface CarteConseil {
  rang: number;
  type: string;
  animation: string;
  couleur: string;
  taille: { libelle: string; valeur: string } | null;
  tailleMinimale: string | null;
  pourquoi: string;
}

type EtatConseil =
  | { type: 'calcul' }
  | { type: 'cartes'; cartes: CarteConseil[]; moinsPrecis: boolean; limite: string | null }
  | { type: 'hors heures'; heures: string; jour: string }
  | { type: 'indisponible' };

type Etat =
  | { type: 'chargement' }
  | { type: 'position introuvable' }
  | { type: 'pret'; carte: CarteConditions };

/** Une explication du moteur finit par un point, comme les phrases du pourquoi. */
const finirParUnPoint = (phrase: string): string => (/[.!?]$/.test(phrase) ? phrase : `${phrase}.`);

@Component({
  selector: 'app-conseil',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    BandeauReglementationComponent,
    MomentFeuilleComponent,
    EspeceFeuilleComponent,
    LieuFeuilleComponent,
    RouterOutlet,
  ],
  host: { class: 'ion-page' },
  styles: `
    /*
     * .selecteur et .selecteur-lieu ([class|=selecteur]). Classe à part pour « Lieu » : des specs plus anciennes (US 82)
     * cherchent le sélecteur « Moment » par button.selecteur, le premier.
     */
    [class|=selecteur] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      min-height: 48px;
      margin: 0 0 12px;
      padding: 8px 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 16px;
      text-align: left;
    }
    .lib {
      display: block;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .val {
      font-size: 17px;
      font-weight: 700;
    }
    .chevron {
      font-size: 22px;
      color: var(--lr-primaire);
    }
    .carte {
      background: var(--lr-surface);
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      padding: 16px;
      color: var(--lr-texte);
    }
    .carte h2 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 700;
    }
    .mention,
    .message,
    .source {
      color: var(--lr-texte-secondaire);
      font-size: 14px;
    }
    .mention {
      margin: -6px 0 12px;
    }
    .badge {
      display: inline-block;
      margin: -4px 0 12px;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--lr-sable);
      color: var(--lr-texte);
      font-size: 14px;
      font-weight: 600;
    }
    .invitation {
      display: block;
      margin-top: 2px;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .message {
      margin: 0;
      padding: 8px 0;
      font-size: 16px;
    }
    dl {
      margin: 0;
    }
    .ligne {
      padding: 10px 0;
      border-top: 1px solid var(--lr-bordure);
    }
    .ligne:first-child {
      border-top: none;
      padding-top: 0;
    }
    dt,
    dd {
      display: inline;
      margin: 0;
      font-size: 16px;
    }
    dt {
      font-weight: 600;
    }
    .eau dd {
      font-size: 22px;
      font-weight: 700;
    }
    .source {
      display: block;
      margin-top: 2px;
    }
    .titre-section {
      margin: 20px 0 8px;
      font-size: 20px;
      font-weight: 700;
      color: var(--lr-texte);
    }
    .conseil {
      margin-bottom: 12px;
    }
    .entete {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .rang {
      flex: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-weight: 700;
      font-size: 16px;
    }
    .conseil h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }
    .conseil .ligne {
      padding: 6px 0;
    }
    .pourquoi {
      margin: 8px 0 0;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .avertissement {
      border-color: var(--lr-danger);
    }
    .alerte {
      margin: 0 0 8px;
      font-size: 17px;
      font-weight: 700;
      color: var(--lr-danger);
    }
    .bouton-sortie {
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
      font-size: 17px;
      font-weight: 600;
      font-family: inherit;
    }
    .bouton-sortie[disabled] {
      opacity: 0.5;
    }
    .bouton-mesure {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 48px;
      margin-top: 10px;
      border: 1px solid var(--lr-primaire);
      border-radius: 12px;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
    }
    .saisie {
      margin-top: 10px;
    }
    .saisie label {
      display: block;
      margin-bottom: 6px;
      font-size: 15px;
      font-weight: 600;
    }
    .saisie .champ {
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      padding: 8px 12px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-fond);
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 17px;
    }
    .saisie .champ.invalide {
      border: 2px solid var(--lr-danger);
    }
    .saisie .erreur {
      margin: 6px 0 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-danger);
    }
    .saisie .actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .saisie .actions button {
      flex: 1;
      min-height: 48px;
      border-radius: 12px;
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
    }
    .saisie .valider {
      border: none;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
    }
    .saisie .annuler {
      border: 1px solid var(--lr-bordure);
      background: transparent;
      color: var(--lr-texte);
    }
    .conseil.touchable {
      position: relative;
    }
    .voir-detail {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: calc(100% + 32px);
      min-height: 48px;
      margin: 8px -16px -16px;
      padding: 0 16px;
      border: none;
      border-top: 1px solid var(--lr-bordure);
      border-radius: 0 0 16px 16px;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
      text-align: left;
    }
    /* Toute la carte est touchable : le bouton s'étend sur la carte. */
    .voir-detail::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .lien-federation {
      display: flex;
      align-items: center;
      min-height: 48px;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-primaire);
      text-decoration: underline;
    }
  `,
  template: `
    @if (!enfantOuvert()) {
    <ion-header>
      <ion-toolbar>
        <ion-title>Conseil</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <button
        #boutonLieu
        type="button"
        class="selecteur-lieu"
        aria-haspopup="dialog"
        (click)="ouvrirChoixLieu()"
      >
        <span>
          <span class="lib">Lieu</span>
          <span class="val">{{ nomLieu() }}</span>
        </span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>
      <button
        #selecteur
        type="button"
        class="selecteur"
        aria-haspopup="dialog"
        [disabled]="!lieuPret()"
        (click)="ouvrirFeuille()"
      >
        <span>
          <span class="lib">Moment</span>
          <span class="val">{{ libelleSelecteur() }}</span>
        </span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>
      <button
        #boutonEspece
        type="button"
        class="selecteur"
        aria-haspopup="dialog"
        (click)="ouvrirChoixEspece()"
      >
        <span>
          <span class="lib">Espèce</span>
          <span class="val">{{ nomEspece() }}</span>
        </span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>
      <section class="carte">
        <h2>Conditions</h2>
        @switch (etat().type) {
          @case ('chargement') {
            <p class="message">Chargement des conditions…</p>
          }
          @case ('position introuvable') {
            <p class="message">
              Position introuvable : autorise la localisation pour voir les conditions.
            </p>
          }
          @default {
            @if (carte(); as c) {
              @if (c.moinsPrecis) {
                <p><span class="badge">Moins précis</span></p>
              }
              @if (c.prevision) {
                <p class="mention">{{ c.prevision }}</p>
              }
              @if (c.mention) {
                <p class="mention">{{ c.mention }}</p>
              }
              <dl>
                <div class="ligne eau">
                  @if (c.eauInconnue) {
                    <dd>Température de l'eau inconnue</dd>
                    <span class="invitation">Mesure-la au thermomètre</span>
                  } @else {
                    <dt>Température de l'eau :</dt>
                    <dd>{{ c.eau }}</dd>
                  }
                  @if (c.sourceEau) {
                    <span class="source">{{ c.sourceEau }}</span>
                  }
                  @if (saisieOuverte()) {
                    <div class="saisie">
                      <label for="temp-mesuree">Température de l'eau (°C)</label>
                      <input
                        #champTemp
                        id="temp-mesuree"
                        class="champ"
                        [class.invalide]="saisieInvalide()"
                        [attr.aria-invalid]="saisieInvalide() ? 'true' : null"
                        [attr.aria-describedby]="saisieInvalide() ? 'erreur-temp-mesuree' : null"
                        type="text"
                        inputmode="decimal"
                        placeholder="Ex. : 12,5"
                        autocomplete="off"
                        [value]="brouillonTemp()"
                        (input)="brouillonTemp.set(champTemp.value)"
                      />
                      @if (saisieInvalide()) {
                        <p id="erreur-temp-mesuree" class="erreur" role="alert">Entre une température entre 0 et 35 °C.</p>
                      }
                      <div class="actions">
                        <button type="button" class="annuler" (click)="fermerSaisie()">Annuler</button>
                        <button type="button" class="valider" (click)="validerSaisie()">Valider</button>
                      </div>
                    </div>
                  } @else {
                    <button #boutonMesure type="button" class="bouton-mesure" (click)="ouvrirSaisie()">
                      J'ai mesuré l'eau
                    </button>
                  }
                </div>
                <div class="ligne">
                  <dt>Débit :</dt>
                  <dd>{{ c.debit }}</dd>
                </div>
                <div class="ligne">
                  <dt>Pression :</dt>
                  <dd>{{ c.pression }}</dd>
                </div>
                <div class="ligne">
                  <dt>Ciel :</dt>
                  <dd>{{ c.ciel }}</dd>
                </div>
                <div class="ligne">
                  <dt>Vent :</dt>
                  <dd>{{ c.vent }}</dd>
                </div>
                <div class="ligne">
                  <dt>Lune :</dt>
                  <dd>{{ c.lune }}</dd>
                </div>
                <div class="ligne">
                  <dt>Heures légales :</dt>
                  <dd>{{ c.heuresLegales }}</dd>
                  <span class="source">À vérifier dans l'arrêté de ton département</span>
                  @if (c.federation; as f) {
                    <a class="lien-federation" [href]="f.url" target="_blank" rel="noopener">{{
                      f.nom
                    }}</a>
                  }
                </div>
              </dl>
            }
          }
        }
      </section>
      <h2 class="titre-section">Ton top 3</h2>
      @if (etat().type === 'position introuvable') {
        <section class="carte">
          <p class="message">
            Localisation indisponible : active la localisation ou choisis un spot enregistré.
          </p>
        </section>
      } @else {
        @switch (conseil().type) {
          @case ('calcul') {
            <section class="carte"><p class="message">Calcul du conseil…</p></section>
          }
          @case ('indisponible') {
            <section class="carte">
              <p class="message">Conseil indisponible pour le moment.</p>
            </section>
          }
          @case ('hors heures') {
            <section class="carte avertissement">
              <p class="alerte">Hors des heures légales : pas de pêche aux carnassiers la nuit.</p>
              <p class="message">Heures légales {{ jourHeuresLegales() }} : {{ heuresDuJour() }}</p>
            </section>
          }
          @default {
            @if (moinsPrecis()) {
              <p><span class="badge">Conseil moins précis</span></p>
            }
            @if (limiteLegale(); as limite) {
              <p class="message">{{ limite }}</p>
            }
            @if (aucunConseil()) {
              <section class="carte">
                <p class="message">Aucun conseil pour cette espèce en ce moment.</p>
              </section>
            }
            @for (c of cartesConseil(); track c.rang) {
              <article class="carte conseil touchable">
                <div class="entete">
                  <span class="rang">{{ c.rang }}</span>
                  <h3 [id]="'titre-conseil-' + c.rang">{{ c.type }}</h3>
                </div>
                <dl>
                  <div class="ligne">
                    <dt>Animation :</dt>
                    <dd>{{ c.animation }}</dd>
                  </div>
                  <div class="ligne">
                    <dt>Couleur :</dt>
                    <dd>{{ c.couleur }}</dd>
                  </div>
                  @if (c.taille; as t) {
                    <div class="ligne">
                      <dt>{{ t.libelle }} :</dt>
                      <dd>{{ t.valeur }}</dd>
                    </div>
                  }
                  @if (c.tailleMinimale; as m) {
                    <div class="ligne">
                      <dt>Taille minimale :</dt>
                      <dd>{{ m }}</dd>
                    </div>
                  }
                </dl>
                <p class="pourquoi">{{ c.pourquoi }}</p>
                <button
                  type="button"
                  class="voir-detail"
                  [id]="'voir-detail-' + c.rang"
                  [attr.aria-labelledby]="'voir-detail-' + c.rang + ' titre-conseil-' + c.rang"
                  [attr.aria-describedby]="'titre-conseil-' + c.rang"
                  (click)="ouvrirDetail(c.rang)"
                >
                  Voir le détail
                  <span aria-hidden="true">›</span>
                </button>
              </article>
            }
          }
        }
      }
      @if (carte(); as c) {
        <app-bandeau-reglementation
          [categorie]="c.categorie"
          [espece]="espece()"
          [especes]="especes()"
          [date]="c.date"
          [federation]="c.federation"
        />
      }
      <button type="button" class="bouton-sortie" disabled>Préparer ma sortie</button>
    </ion-content>
    @if (feuilleOuverte()) {
      <app-moment-feuille
        [jourInitial]="jourBrouillon()"
        [heureInitiale]="heureBrouillon()"
        (maintenant)="choisirMaintenant()"
        (valide)="appliquerMoment($event)"
        (ferme)="fermerFeuille()"
      />
    }
    @if (lieuOuvert()) {
      <app-lieu-feuille
        [spots]="spotsEnregistres()"
        [etat]="etatSpots()"
        [choisi]="spotChoisi()?.id ?? null"
        (choisir)="choisirLieu($event)"
        (annuler)="fermerChoixLieu()"
      />
    }
    @if (choixOuvert()) {
      <app-espece-feuille
        [choix]="choixEspeces()"
        [choisie]="espece()?.code ?? null"
        (choisir)="choisirEspece($event)"
        (annuler)="fermerChoixEspece()"
      />
    }
    }
    <router-outlet />
  `,
})
export class ConseilPage implements OnInit {
  private readonly position = inject(PositionService);
  private readonly conditions = inject(ConditionsService);
  private readonly astro = inject(AstroService);
  private readonly catalogue = inject(CatalogService);
  private readonly moteur = inject(MoteurService);
  private readonly onboarding = inject(OnboardingStore);
  private readonly spots = inject(SpotsService);
  private readonly saisieTempEau = inject(SaisieTempEauStore);
  private readonly detailStore = inject(ConseilDetailStore);
  private readonly router = inject(Router);
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Vrai quand le détail d'un conseil ou la fiche animation est ouvert : l'écran « Conseil » laisse la place à l'enfant, le top 3 reste dans le composant. */
  protected readonly enfantOuvert = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.urlEnfant()),
      startWith(this.urlEnfant()),
    ),
    { requireSync: true },
  );

  protected readonly saisieOuverte = signal(false);
  protected readonly saisieInvalide = signal(false);
  protected readonly brouillonTemp = signal('');
  private readonly champTemp = viewChild<ElementRef<HTMLInputElement>>('champTemp');

  private readonly boutonMesure = viewChild<ElementRef<HTMLButtonElement>>('boutonMesure');
  /** La dernière mesure validée, gardée en mémoire : elle compte même si le stockage du téléphone la refuse. */
  private saisieMemoire: SaisieTempEau | null = null;
  private focusSurBouton = false;
  /** La carte dont le détail a été ouvert : son bouton « Voir le détail » reprend le focus au retour. */
  private rangOuvert: number | null = null;
  /** Le défilement de l'écran au moment d'ouvrir le détail, rendu au retour (l'écran est recréé). */
  private defilement = 0;
  private readonly contenu = viewChild(IonContent);
  private readonly injector = inject(Injector);

  constructor() {
    // Au retour du détail, le focus revient sur le bouton de la carte ouverte.
    effect(() => {
      if (this.enfantOuvert() || this.rangOuvert === null) return;
      const rang = this.rangOuvert;
      this.rangOuvert = null;
      // L'écran est recréé : on attend son rendu avant de rendre le défilement et le focus.
      afterNextRender(
        () =>
          setTimeout(() => {
            this.hostEl.nativeElement.querySelector<HTMLElement>(`#voir-detail-${rang}`)?.focus({ preventScroll: true });
            void this.contenu()?.scrollToPoint(0, this.defilement, 0)?.catch(() => undefined);
          }),
        { injector: this.injector },
      );
    });
    // Le focus entre dans le champ dès qu'il s'ouvre.
    effect(() => this.champTemp()?.nativeElement.focus());
    // Et revient au bouton « J'ai mesuré l'eau » quand la saisie se ferme par Annuler ou Valider.
    effect(() => {
      const bouton = this.boutonMesure();
      if (bouton && this.focusSurBouton) {
        this.focusSurBouton = false;
        bouton.nativeElement.focus();
      }
    });
  }

  protected readonly etat = signal<Etat>({ type: 'chargement' });

  protected readonly conseil = signal<EtatConseil>({ type: 'calcul' });

  private readonly selecteur = viewChild<ElementRef<HTMLButtonElement>>('selecteur');
  /** Vrai dès que la position est connue : avant, un moment choisi n'aurait aucun lieu où s'appliquer. */
  protected readonly lieuPret = signal(false);
  /** Le moment choisi ; `null` = « Maintenant ». État du composant, jamais mémorisé. */
  private readonly moment = signal<MomentChoisi | null>(null);
  protected readonly libelleSelecteur = computed(() => this.moment()?.libelle ?? 'Maintenant');
  protected readonly feuilleOuverte = signal(false);
  protected readonly jourBrouillon = signal<JourMoment>('aujourdhui');
  protected readonly heureBrouillon = signal(0);

  /** L'espèce visée ; `null` pour « Toutes les espèces ». Gardée tant que la page vit, jamais mémorisée. */
  protected readonly espece = signal<Espece | null>(null);
  protected readonly choixOuvert = signal(false);
  protected readonly choixEspeces = signal<ChoixEspece[]>([]);
  private readonly bouton = viewChild.required<ElementRef<HTMLElement>>('boutonEspece');
  /** Les fiches du contenu, lues au chargement d'un moment (bandeau « Toutes les espèces ») et à l'ouverture du choix. */
  protected readonly especes = signal<Espece[]>([]);

  private lieu: Lieu | null = null;

  /** Le spot qui sert de lieu ; `null` = « Ma position ». État du composant, jamais mémorisé. */
  protected readonly spotChoisi = signal<SpotEnregistre | null>(null);
  protected readonly lieuOuvert = signal(false);
  protected readonly spotsEnregistres = signal<SpotEnregistre[]>([]);
  protected readonly etatSpots = signal<EtatSpots>('chargement');
  protected readonly nomLieu = computed(() => this.spotChoisi()?.nom ?? 'Ma position');
  private readonly boutonLieu = viewChild<ElementRef<HTMLButtonElement>>('boutonLieu');
  /** Numéro du dernier choix de lieu : une position obtenue pour un choix plus ancien est ignorée. */
  private choixLieu = 0;
  /** Numéro de la dernière lecture des spots. */
  private lectureSpots = 0;
  /**
   * Le relevé du moment affiché, une fois la pêche reconnue légale : changer d'espèce ne relit pas les conditions.
   * `null` hors des heures légales et tant que le moment se charge : une espèce choisie alors ne lance aucun calcul.
   */
  private relancable: ConseilRelancable | null = null;
  /** Numéro du dernier calcul demandé (moment ou espèce) : un résultat plus ancien est ignoré. */
  private calcul = 0;

  protected nomEspece(): string {
    return this.espece()?.nom ?? TOUTES;
  }

  protected aucunConseil(): boolean {
    return this.espece() !== null && this.cartesConseil().length === 0;
  }

  protected async ouvrirChoixEspece(): Promise<void> {
    let especes: Espece[] = [];
    try {
      especes = await this.catalogue.especes();
    } catch {
      // Sans contenu, la liste ne propose que « Toutes les espèces ».
    }
    this.choixEspeces.set([
      { code: null, nom: TOUTES },
      ...especes.map((e) => ({ code: e.code, nom: e.nom })),
    ]);
    this.choixOuvert.set(true);
    this.especes.set(especes);
  }

  /** Sans contenu des espèces (panne, double sans `especes`), le bandeau n'a simplement pas d'alerte d'espèce. */
  private async chargerEspeces(): Promise<void> {
    try {
      this.especes.set(await this.catalogue.especes());
    } catch {
      // Le bandeau reste calculé sans alerte d'espèce.
    }
  }

  /** Les espèces du contenu ; sans elles le détail n'affiche ni espèce ni postes, mais le conseil reste affiché. */
  private async especesDuContenu(): Promise<Espece[]> {
    try {
      return await this.catalogue.especes();
    } catch {
      return [];
    }
  }

  protected async ouvrirChoixLieu(): Promise<void> {
    const lecture = ++this.lectureSpots;
    this.etatSpots.set('chargement');
    this.spotsEnregistres.set([]);
    this.lieuOuvert.set(true);
    try {
      const spots = await this.spots.mesSpots();
      if (lecture !== this.lectureSpots) return;
      this.spotsEnregistres.set(spots);
      this.etatSpots.set('pret');
    } catch {
      if (lecture === this.lectureSpots) this.etatSpots.set('erreur');
    }
  }

  protected fermerChoixLieu(): void {
    this.lieuOuvert.set(false);
    this.boutonLieu()?.nativeElement.focus();
  }

  protected choisirLieu(spot: SpotEnregistre | null): void {
    this.fermerChoixLieu();
    // Même lieu : rien à refaire, sauf si la position manque encore (« Ma position » se redemande).
    if ((spot?.id ?? null) === (this.spotChoisi()?.id ?? null) && this.etat().type !== 'position introuvable') return;
    this.spotChoisi.set(spot);
    void this.appliquerLieu(spot);
  }

  protected fermerChoixEspece(): void {
    this.choixOuvert.set(false);
    this.bouton().nativeElement.focus();
  }

  protected choisirEspece(code: string | null): void {
    const choisie = code === null ? null : (this.especes().find((e) => e.code === code) ?? null);
    this.fermerChoixEspece();
    if ((choisie?.code ?? null) === (this.espece()?.code ?? null)) return;
    this.espece.set(choisie);
    const courant = this.relancable;
    if (courant) void this.chargerConseil(courant.releve, courant.moment, courant.limite);
  }

  private urlEnfant(): boolean {
    return this.router.url.split(/[?#]/)[0].startsWith('/conseil/');
  }

  protected async ouvrirDetail(rang: number): Promise<void> {
    this.rangOuvert = rang;
    this.defilement = 0;
    try {
      this.defilement = (await this.contenu()?.getScrollElement())?.scrollTop ?? 0;
    } catch {
      // Sans position de défilement, l'écran se rouvre en haut.
    }
    await this.router.navigate(['/conseil', 'detail', rang]);
  }

  protected heuresDuJour(): string {
    const etat = this.conseil();
    return etat.type === 'hors heures' ? etat.heures : '';
  }

  protected jourHeuresLegales(): string {
    const etat = this.conseil();
    return etat.type === 'hors heures' ? etat.jour : '';
  }

  protected moinsPrecis(): boolean {
    const etat = this.conseil();
    return etat.type === 'cartes' && etat.moinsPrecis;
  }

  protected limiteLegale(): string | null {
    const etat = this.conseil();
    return etat.type === 'cartes' ? etat.limite : null;
  }

  protected cartesConseil(): CarteConseil[] {
    const etat = this.conseil();
    return etat.type === 'cartes' ? etat.cartes : [];
  }

  protected carte(): CarteConditions | null {
    const etat = this.etat();
    return etat.type === 'pret' ? etat.carte : null;
  }

  ngOnInit(): void {
    void this.charger();
  }

  protected ouvrirFeuille(): void {
    const maintenant = new Date();
    const courant = jourEtHeure(this.moment()?.date ?? maintenant, maintenant);
    this.jourBrouillon.set(courant?.jour ?? 'aujourdhui');
    this.heureBrouillon.set(courant?.heure ?? 0);
    this.feuilleOuverte.set(true);
  }

  protected ouvrirSaisie(): void {
    this.brouillonTemp.set('');
    this.saisieInvalide.set(false);
    this.saisieOuverte.set(true);
  }

  protected fermerSaisie(): void {
    this.focusSurBouton = true;
    this.fermerSaisieSansFocus();
  }

  private fermerSaisieSansFocus(): void {
    this.saisieOuverte.set(false);
    this.saisieInvalide.set(false);
    this.brouillonTemp.set('');
  }

  /** Une température valide est gardée, puis le moment affiché est recalculé avec elle. */
  protected validerSaisie(): void {
    const valeurC = lireTempSaisie(this.brouillonTemp());
    if (valeurC === null) {
      this.saisieInvalide.set(true);
      return;
    }
    const maintenant = new Date();
    const saisie = { valeurC, mesureeA: maintenant };
    this.saisieMemoire = saisie;
    this.saisieTempEau.ecrire(saisie);
    this.fermerSaisie();
    const choisi = this.moment();
    void this.chargerMoment(choisi?.date ?? maintenant, choisi);
  }

  /** Ferme la feuille et rend le focus au sélecteur. */
  protected fermerFeuille(): void {
    this.feuilleOuverte.set(false);
    this.selecteur()?.nativeElement.focus();
  }

  protected choisirMaintenant(): void {
    this.fermerFeuille();
    void this.chargerMoment(new Date(), null);
  }

  /** Le moment a déjà été validé (strictement futur, dans les 48 h) par la feuille. */
  protected appliquerMoment(date: Date): void {
    const maintenant = new Date();
    this.fermerFeuille();
    void this.chargerMoment(date, {
      date,
      libelle: libelleMoment(date, maintenant),
      mention: mentionMoment(date, maintenant),
    });
  }

  /** Au départ : lieu = position GPS, moment = maintenant. */
  private async charger(): Promise<void> {
    // « Plus tard » à l'onboarding : pas de demande de localisation pour ce lancement.
    if (this.onboarding.localisationDifferee) {
      this.etat.set({ type: 'position introuvable' });
      return;
    }
    // La réponse obtenue à la page 3 de l'onboarding sert une fois : le téléphone n'est pas sollicité deux fois.
    await this.appliquerLieu(null, this.onboarding.prendrePosition());
  }

  /** Périme les calculs en cours et vide l'écran : plus rien de l'ancien lieu, ni moment ni espèce ne s'y applique. */
  private invaliderEcran(): void {
    this.calcul++;
    this.lieu = null;
    this.lieuPret.set(false);
    this.relancable = null;
    this.detailStore.details.set([]);
    this.fermerSaisieSansFocus();
    this.etat.set({ type: 'chargement' });
    this.conseil.set({ type: 'calcul' });
  }

  /**
   * Lieu = position GPS (`spot` nul) ou spot enregistré (pas de GPS). Le moment choisi est gardé.
   * Un choix plus récent l'emporte sur une position encore attendue.
   */
  private async appliquerLieu(spot: SpotEnregistre | null, positionDonnee: ResultatPosition | null = null): Promise<void> {
    const numero = ++this.choixLieu;
    // L'écran ne montre plus l'ancien lieu pendant qu'on attend la position (le GPS peut être long).
    this.invaliderEcran();
    const position = spot
      ? await this.position.positionSpot(spot)
      : (positionDonnee ?? (await this.position.positionGps()));
    if (numero !== this.choixLieu) return;
    if (!position.disponible) {
      this.etat.set({ type: 'position introuvable' });
      return;
    }
    this.lieuPret.set(true);
    this.lieu = { latitude: position.latitude, longitude: position.longitude, spot };
    const choisi = this.moment();
    await this.chargerMoment(choisi?.date ?? new Date(), choisi);
  }

  /** Recalcule conditions, heures légales et top 3 pour ce moment. Un choix plus récent l'emporte. */
  private async chargerMoment(moment: Date, choisi: MomentChoisi | null): Promise<void> {
    const lieu = this.lieu;
    if (!lieu) return;
    const { spot, latitude, longitude } = lieu;
    const coordonnees = { latitude, longitude };
    const numero = ++this.calcul;
    const perime = () => numero !== this.calcul;
    this.relancable = null;
    // Un nouveau calcul périme le top 3 : le détail ne doit plus l'ouvrir (hors heures, indisponible ou calcul en cours).
    this.detailStore.details.set([]);
    this.fermerSaisieSansFocus();
    void this.chargerEspeces();
    this.moment.set(choisi);
    this.etat.set({ type: 'chargement' });
    this.conseil.set({ type: 'calcul' });
    const releve = await this.conditions.releve({
      lieu: coordonnees,
      moment,
      niveau: this.onboarding.lire()?.niveau ?? 'debutant',
      ...(spot ? { spot: { categorie: spot.categorie, departement: spot.departement } } : {}),
      saisieTempEau: this.saisieMemoire ?? this.saisieTempEau.lire() ?? undefined,
    });
    if (perime()) return;
    const heures = heuresLegales(this.astro.soleil(coordonnees, moment));
    const federation = await this.catalogue.federation(releve.conditions.departement);
    if (perime()) return;
    const texteHeures = heures ? formaterHeuresLegales(heures.debut, heures.fin) : 'Indisponible';
    this.etat.set({
      type: 'pret',
      carte: {
        ...this.composer(releve, this.astro.lune(moment, coordonnees).phase, texteHeures),
        prevision: choisi ? `Prévisions pour ${choisi.mention}` : undefined,
        federation,
        date: moment,
        categorie: spot?.categorie ?? null,
      },
    });
    if (heures && !this.pecheLegale(moment, heures, choisi !== null)) {
      this.conseil.set({
        type: 'hors heures',
        heures: texteHeures,
        jour: choisi ? motDuJour(moment, new Date()) : "aujourd'hui",
      });
      return;
    }
    const limite = choisi && heures ? this.limiteDansLHeure(moment, heures) : null;
    this.relancable = { releve, moment, limite };
    await this.chargerConseil(releve, moment, limite);
  }

  /**
   * Un moment choisi vaut pour toute son heure (choix « à l'heure près ») : « demain 7 h » est légal dès que
   * l'heure 7 h – 8 h touche les heures légales (7 h 02 – 18 h 31). « Maintenant » reste exact à la minute.
   */
  private pecheLegale(moment: Date, heures: HeuresLegales, heureEntiere: boolean): boolean {
    if (dansHeuresLegales(moment, heures)) return true;
    return heureEntiere && dansHeuresLegales(new Date(moment.getTime() + UNE_HEURE_MS - 1), heures);
  }

  /** Pour un moment choisi : « Pêche légale à partir de 7 h 02 » ou « … jusqu'à 18 h 31 » quand une borne tombe dans son heure. */
  private limiteDansLHeure(moment: Date, heures: HeuresLegales): string | null {
    const debutHeure = moment.getTime();
    const finHeure = debutHeure + UNE_HEURE_MS;
    if (heures.debut.getTime() > debutHeure && heures.debut.getTime() < finHeure) {
      return `Pêche légale à partir de ${formaterHeure(heures.debut)}`;
    }
    if (heures.fin.getTime() >= debutHeure && heures.fin.getTime() < finHeure) {
      return `Pêche légale jusqu'à ${formaterHeure(heures.fin)}`;
    }
    return null;
  }

  /** Le top 3 du moteur. Une panne du moteur ou du contenu n'abîme ni la carte « Conditions » ni le bandeau. */
  private async chargerConseil(
    releve: ReleveActuel,
    moment: Date,
    limite: string | null,
  ): Promise<void> {
    const numero = ++this.calcul;
    const perime = () => numero !== this.calcul;
    const cible = this.espece();
    const conditions = { ...releve.conditions };
    delete conditions.especeCible;
    if (cible) conditions.especeCible = cible.code;
    this.detailStore.details.set([]);
    this.conseil.set({ type: 'calcul' });
    try {
      const [resultat, types, animations, couleurs, especes] = await Promise.all([
        this.moteur.conseiller(conditions, moment),
        this.catalogue.typesDeLeurres(),
        this.catalogue.animations(),
        this.catalogue.couleurs(),
        this.especesDuContenu(),
      ]);
      if (perime()) return;
      this.detailStore.details.set(
        resultat.conseils.map((c, i) => detailDuConseil(i + 1, c, { types, animations, couleurs, especes })),
      );
      this.detailStore.toutesEspeces.set(cible === null);
      const cartes = resultat.conseils.map((c, i): CarteConseil => ({
        rang: i + 1,
        type: types.find((t) => t.id === c.typeId)?.nom ?? c.typeId,
        animation: animations.find((a) => a.id === c.techniqueId)?.nom ?? c.techniqueId,
        couleur: couleurs.find((x) => x.id === c.couleur)?.nom ?? c.couleur,
        taille: c.taille
          ? { libelle: libelleTaille(c.taille), valeur: formaterTaille(c.taille) }
          : null,
        tailleMinimale: cible && tailleMinimale(cible) !== null ? libelleTailleMinimale(cible) : null,
        pourquoi: [premierePhrase(c.pourquoi[0] ?? ''), ...(resultat.explications ?? []).map(finirParUnPoint)].filter(Boolean).join(' '),
      }));
      this.conseil.set({ type: 'cartes', cartes, moinsPrecis: releve.moinsPrecis, limite });
    } catch {
      if (!perime()) this.conseil.set({ type: 'indisponible' });
    }
  }

  private composer(
    releve: ReleveActuel,
    lune: string,
    heures: string,
  ): Omit<CarteConditions, 'federation' | 'date' | 'prevision' | 'categorie'> {
    const { conditions } = releve;
    return {
      mention: releve.mention,
      moinsPrecis: releve.moinsPrecis,
      eauInconnue: conditions.tempEau === null,
      eau: formaterTempEau(conditions.tempEau),
      sourceEau: formaterSourceTempEau(releve),
      debit: formaterDebit(releve),
      pression: formaterPression(releve.pressionHpa, conditions.pressionTendance48h),
      ciel: formaterCiel(conditions.nuages),
      vent: formaterVent(conditions.vent),
      lune,
      heuresLegales: heures,
    };
  }
}
