import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, OnInit, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { bagHandleOutline, briefcaseOutline, checkmarkOutline, locationOutline, personOutline } from 'ionicons/icons';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService, Espece, FamilleLeurre, Federation, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { FeedbackService } from '../../core/data/feedback.service';
import { LieuDemandeService } from '../../core/data/lieu-demande.service';
import { MesureAudienceService } from '../../core/data/mesure-audience.service';
import { OnboardingStore } from '../../core/data/onboarding.store';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { messagePreparation, SortieService } from '../../core/data/sortie.service';
import { SpotEnregistre, SpotsService } from '../../core/data/spots.service';
import { SaisieTempEauStore } from '../../core/data/saisie-temp-eau.store';
import { Conditions } from '../../core/engine/conditions';
import { SaisieTempEau } from '../../core/engine/temperature-eau';
import { dansHeuresLegales, HeuresLegales, heuresLegales } from '../../core/regulation/legal-hours';
import { UnitesService } from '../../shared/unites.service';
import { BandeauReglementationComponent } from './bandeau-reglementation.component';
import { EtatSpots, LieuFeuilleComponent } from './lieu-feuille.component';
import { MomentFeuilleComponent } from './moment-feuille.component';
import {
  formaterCiel,
  formaterDebit,
  formaterHeure,
  formaterHeuresLegales,
  formaterMeteo,
  formaterPression,
  formaterSourceTempEau,
  formaterTempEau,
  formaterVent,
} from './conditions-format';
import { ConseilChoixStore, MomentChoisi, SortiePrete } from './conseil-choix.store';
import { ConseilDetailStore } from './conseil-detail.store';
import { detailDuConseil, formaterTaille, LigneBoite, libelleTaille, lireTempSaisie } from './conseil-format';
import { AvisDonne, CoupRiviere, DemandeDetail, RiviereEnCoupeComponent, VueRiviere, ZoneNage } from './riviere-en-coupe.component';
import { FeuilleConseilComponent } from './feuille-conseil.component';
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
  /** « Nuageux, vent 12 km/h » : la ligne sous la température de l'eau. */
  meteo: string;
  federation?: Federation;
  date: Date;
  /** Catégorie du spot du relevé affiché ; `null` pour la position GPS. */
  categorie: 1 | 2 | null;
}

/** Une carte de conseil, déjà traduite en noms et formatée. */
interface CarteConseil {
  rang: number;
  typeId: string;
  techniqueId: string;
  type: string;
  animation: string;
  couleur: string;
  taille: { libelle: string; valeur: string } | null;
  /** Zone de nage du type de leurre (contenu `lure-types.json`) : où la rivière pose le coup. */
  zone: ZoneNage;
  famille: FamilleLeurre | null;
}

/** La ligne d'état réglementaire sous le moment et l'espèce. */
interface EtatLegal {
  type: 'ouvert' | 'fermeture' | 'ferme';
  texte: string;
}

const MINUTES_AVANT_FERMETURE = 30;

type EtatConseil =
  | { type: 'calcul' }
  | { type: 'cartes'; cartes: CarteConseil[]; moinsPrecis: boolean; limite: string | null; explications: string[] }
  | { type: 'hors heures'; heures: string; jour: string }
  | { type: 'indisponible' };

type Etat =
  | { type: 'chargement' }
  | { type: 'position introuvable' }
  | { type: 'pret'; carte: CarteConditions };

/** Un clic principal sans touche : tout autre clic garde le comportement natif du lien (nouvel onglet, nouvelle fenêtre). */
const estClicSimple = (e: MouseEvent): boolean => e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;

/** « Dans ta boîte », « À la place, dans ta boîte » ou « Il te manque » : la ligne de la boîte sans le détail du leurre. */
const libelleBoite = (ligne: LigneBoite): string => ligne.libelle.replace(/\s*:$/, '');

/** Une explication du moteur finit par un point, comme les phrases du pourquoi. */
const finirParUnPoint = (phrase: string): string => (/[.!?]$/.test(phrase) ? phrase : `${phrase}.`);

addIcons({ bagHandleOutline, briefcaseOutline, checkmarkOutline, locationOutline, personOutline });


@Component({
  selector: 'app-conseil',
  imports: [
    IonContent,
    BandeauReglementationComponent,
    FeuilleConseilComponent,
    RiviereEnCoupeComponent,
    MomentFeuilleComponent,
    EspeceFeuilleComponent,
    LieuFeuilleComponent,
    RouterOutlet,
    IonIcon,
  ],
  host: { class: 'ion-page' },
  styles: `
    ion-content {
      --padding-top: 0;
      --padding-bottom: 0;
      --padding-start: 0;
      --padding-end: 0;
    }
    .ecran {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      color: var(--lr-texte);
    }
    .ic {
      flex: none;
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .ic.petit {
      width: 16px;
      height: 16px;
    }
    .haut {
      flex: none;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: calc(4px + var(--ion-safe-area-top, 0px)) 16px 0;
    }
    .titre-lieu {
      flex: 1;
      min-width: 0;
      margin: 0;
      font-family: var(--lr-police-titre);
    }
    .lieu {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      min-height: 48px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--lr-texte);
      font: 700 26px/1 var(--lr-police-titre);
      text-align: left;
    }
    .lieu span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Lu par les lecteurs d'écran seulement : le lieu est le titre de l'écran. */
    .lieu .masque {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 48px;
      height: 48px;
      border: 1.5px solid var(--lr-bordure);
      border-radius: 24px;
      background: transparent;
      color: var(--lr-texte);
      font-size: 24px;
    }
    .choix {
      flex: none;
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 8px;
      padding: 2px 16px 0;
    }
    .pastille {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 48px;
      padding: 0 14px;
      border: 1px solid var(--lr-bordure);
      border-radius: 24px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      text-align: left;
    }
    .pastille small {
      color: var(--lr-texte-secondaire);
      font-size: 15px;
      font-weight: 500;
    }
    .pastille span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .etat {
      flex: none;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
      padding: 0 16px;
      border: 0;
      background: none;
      color: var(--lr-texte-secondaire);
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      text-align: left;
    }
    .etat.ok {
      color: var(--lr-ok);
    }
    .etat.attention {
      color: var(--lr-attention);
    }
    .etat.ferme {
      color: var(--lr-danger);
    }
    .etat .suite {
      color: var(--lr-texte-secondaire);
    }
    p.etat {
      margin: 0;
    }
    .eau {
      flex: none;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-height: 52px;
      padding: 0 16px 10px;
    }
    .temp {
      font-family: var(--lr-police-titre);
      font-size: 44px;
      font-weight: 700;
      line-height: 44px;
    }
    .temp.inconnue {
      max-width: 150px;
      font-size: 20px;
      line-height: 22px;
    }
    .infos {
      flex: 1;
      min-width: 0;
    }
    .src {
      font-size: 13px;
      line-height: 17px;
      color: var(--lr-texte-secondaire);
    }
    .meteo {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      min-height: 48px;
      margin-top: -6px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      text-align: left;
    }
    .thermo {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 48px;
      height: 48px;
      margin-left: auto;
      border: 1.5px solid var(--lr-bordure);
      border-radius: 24px;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    .squelette {
      width: 96px;
      height: 44px;
      border-radius: 8px;
      background: var(--lr-sable);
    }
    .badge {
      display: inline-block;
      margin: 0 0 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--lr-sable);
      color: var(--lr-texte);
      font-size: 14px;
      font-weight: 600;
    }
    .mention {
      margin: 0 0 6px;
      color: var(--lr-texte-secondaire);
      font-size: 14px;
    }
    dl {
      margin: 0;
    }
    .ligne {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      border-top: 1px solid var(--lr-bordure);
      font-size: 15px;
    }
    dt {
      font-weight: 600;
    }
    dd {
      margin: 0;
      text-align: right;
    }
    .limite {
      margin: 0 0 6px;
      color: var(--lr-texte-secondaire);
      font-size: 14px;
    }
    .saisie label {
      display: block;
      margin: 6px 0;
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
    .zone-dock {
      flex: none;
      border-top: 1px solid var(--lr-bordure);
      background: var(--lr-surface);
    }
    .message-sortie {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 40px;
      margin: 0;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 600;
    }
    .message-sortie.prete {
      color: var(--lr-texte);
    }
    .message-sortie ion-icon {
      flex: none;
      font-size: 20px;
      color: var(--lr-ok);
    }
    .message-sortie.echec {
      color: var(--lr-danger);
    }
    .dock {
      display: grid;
      grid-template-columns: 1fr 1.4fr 1fr;
      gap: 8px;
      padding: 10px 16px;
      padding-bottom: calc(10px + var(--ion-safe-area-bottom, 0px));
    }
    .dock a,
    .dock button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 56px;
      border: 1.5px solid var(--lr-bordure);
      border-radius: 14px;
      background: transparent;
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
    }
    .dock .action {
      border-color: var(--lr-primaire);
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-weight: 700;
    }
    .dock .action[disabled] {
      opacity: 0.5;
    }
  `,
  template: `
    @if (!enfantOuvert()) {
    <ion-content [scrollY]="false">
      <div class="ecran">
        <div class="haut">
          <h1 class="titre-lieu">
            <button
              #boutonLieu
              type="button"
              class="lieu"
              aria-haspopup="dialog"
              (click)="ouvrirChoixLieu()"
            >
              <span class="masque">Lieu : </span><span>{{ nomLieu() }}</span>
              <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </h1>
          <button type="button" class="avatar" aria-label="Compte" (click)="ouvrir($event, '/compte')">
            <ion-icon name="person-outline" aria-hidden="true"></ion-icon>
          </button>
        </div>
        <div class="choix">
          <button #selecteur type="button" class="pastille selecteur" aria-haspopup="dialog" [disabled]="!lieuPret()" (click)="ouvrirFeuille()">
            <small>Moment</small> <span>{{ libelleSelecteur() }}</span>
          </button>
          <button #boutonEspece type="button" class="pastille selecteur" aria-haspopup="dialog" (click)="ouvrirChoixEspece()">
            <small>Espèce</small> <span>{{ nomEspece() }}</span>
          </button>
        </div>
        @switch (etat().type) {
          @case ('chargement') {
            <p class="etat" role="status">Chargement des conditions…</p>
            <div class="eau" aria-hidden="true"><div class="squelette"></div></div>
          }
          @case ('position introuvable') {
            <div class="etat"></div>
          }
          @default {
            @if (legal(); as l) {
              <button
                type="button"
                class="etat"
                [class.ok]="l.type === 'ouvert'"
                [class.attention]="l.type === 'fermeture'"
                [class.ferme]="l.type === 'ferme'"
                aria-haspopup="dialog"
                (click)="reglementationOuvert.set(true)"
              >
                @switch (l.type) {
                  @case ('ouvert') {
                    <svg class="ic" data-icone="livre" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></svg>
                    {{ l.texte }}
                  }
                  @case ('fermeture') {
                    <svg class="ic" data-icone="alerte" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l9.5 17h-19z" /><path d="M12 10v5M12 18v.2" /></svg>
                    {{ l.texte }}
                  }
                  @case ('ferme') {
                    <svg class="ic" data-icone="lune" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" /></svg>
                    {{ l.texte }}
                  }
                }
                <svg class="ic petit suite" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            } @else {
              <button type="button" class="etat" aria-haspopup="dialog" (click)="reglementationOuvert.set(true)">
                Réglementation
                <svg class="ic petit suite" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            }
            @if (carte(); as c) {
              <div class="eau">
                <div>
                  @if (c.eauInconnue) {
                    <div class="temp inconnue">Température de l'eau inconnue</div>
                  } @else {
                    <div class="temp">{{ c.eau }}</div>
                  }
                </div>
                <div class="infos">
                  <div class="src">
                    {{ c.eauInconnue ? 'Mesure-la au thermomètre' : c.sourceEau }}
                    @if (c.mention) {
                      · {{ c.mention }}
                    }
                  </div>
                  <button #boutonConditions type="button" class="meteo" aria-haspopup="dialog" (click)="conditionsOuvert.set(true)">
                    {{ c.meteo }}
                    <svg class="ic petit" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                </div>
                <button #boutonThermo type="button" class="thermo" aria-label="Saisir la température de l'eau" aria-haspopup="dialog" (click)="ouvrirSaisie()">
                  <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a2 2 0 0 1 4 0v10.2a4 4 0 1 1-4 0z" /><path d="M12 9v7" /></svg>
                </button>
              </div>
            }
          }
        }
        <app-riviere-en-coupe
          [vue]="vueRiviere()"
          [moinsPrecis]="moinsPrecis()"
          [avisDonnes]="avisDonnes()"
          (detail)="ouvrirDetail($event)"
          (avis)="donnerAvis($event)"
        />
      </div>
    </ion-content>
    <div class="zone-dock">
      @if (messageSortie(); as m) {
        <p class="message-sortie" [class.prete]="m.type === 'prete'" [class.echec]="m.type !== 'prete'" [attr.role]="m.type === 'prete' ? 'status' : 'alert'">
          @if (m.type === 'prete') {
            <ion-icon name="checkmark-outline" aria-hidden="true"></ion-icon>
          }
          {{ m.texte }}
        </p>
      }
      <nav class="dock" aria-label="Navigation">
        <a href="/boite" (click)="ouvrir($event, '/boite')"><ion-icon name="briefcase-outline" aria-hidden="true"></ion-icon>Boîte</a>
        <button type="button" class="action" [disabled]="!lieuPret() || preparationEnCours()" (click)="preparerSortie()">
          <ion-icon name="bag-handle-outline" aria-hidden="true"></ion-icon>{{ preparationEnCours() ? 'Préparation…' : 'Ma sortie' }}
        </button>
        <a href="/spots" (click)="ouvrir($event, '/spots')"><ion-icon name="location-outline" aria-hidden="true"></ion-icon>Spots</a>
      </nav>
    </div>
    @if (conditionsOuvert() && carte(); as c) {
      <app-feuille-conseil titre="Conditions" (ferme)="fermerConditions()">
        <p class="mention">{{ c.prevision ?? 'Maintenant' }} · {{ nomLieu() }}</p>
        @if (c.moinsPrecis) {
          <p><span class="badge">Moins précis</span></p>
        }
        <dl>
          <div class="ligne">
            <dt>Eau</dt>
            &ngsp;
            <dd>{{ c.eauInconnue ? 'Température de l\\'eau inconnue' : c.eau }}</dd>
          </div>
          <div class="ligne">
            <dt>Débit</dt>
            &ngsp;
            <dd>{{ c.debit }}</dd>
          </div>
          <div class="ligne">
            <dt>Pression</dt>
            &ngsp;
            <dd>{{ c.pression }}</dd>
          </div>
          <div class="ligne">
            <dt>Ciel</dt>
            &ngsp;
            <dd>{{ c.ciel }}</dd>
          </div>
          <div class="ligne">
            <dt>Vent</dt>
            &ngsp;
            <dd>{{ c.vent }}</dd>
          </div>
          <div class="ligne">
            <dt>Lune</dt>
            &ngsp;
            <dd>{{ c.lune }}</dd>
          </div>
          <div class="ligne">
            <dt>Heures légales</dt>
            &ngsp;
            <dd>{{ c.heuresLegales }}</dd>
          </div>
        </dl>
      </app-feuille-conseil>
    }
    @if (reglementationOuvert()) {
      <app-feuille-conseil titre="Réglementation" (ferme)="fermerReglementation()">
        @if (limiteLegale(); as limite) {
          <p class="limite">{{ limite }}</p>
        }
        @if (carte(); as c) {
          <app-bandeau-reglementation
            [categorie]="c.categorie"
            [espece]="espece()"
            [especes]="especes()"
            [date]="c.date"
            [federation]="c.federation"
            [heuresLegales]="c.heuresLegales"
          />
        }
      </app-feuille-conseil>
    }
    @if (saisieOuverte()) {
      <app-feuille-conseil titre="Température de l'eau" (ferme)="fermerSaisie()">
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
      </app-feuille-conseil>
    }
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
  private readonly unites = inject(UnitesService);
  private readonly router = inject(Router);
  private readonly lieuDemande = inject(LieuDemandeService);
  private readonly feedback = inject(FeedbackService);
  private readonly sortie = inject(SortieService);
  private readonly choix = inject(ConseilChoixStore);
  private readonly mesure = inject(MesureAudienceService);
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

  protected readonly conditionsOuvert = signal(false);
  protected readonly reglementationOuvert = signal(false);
  protected readonly legal = signal<EtatLegal | null>(null);
  protected readonly saisieOuverte = signal(false);
  protected readonly saisieInvalide = signal(false);
  protected readonly brouillonTemp = signal('');
  private readonly champTemp = viewChild<ElementRef<HTMLInputElement>>('champTemp');

  private readonly boutonThermo = viewChild<ElementRef<HTMLButtonElement>>('boutonThermo');
  private readonly boutonConditions = viewChild<ElementRef<HTMLButtonElement>>('boutonConditions');
  /** La dernière mesure validée, gardée en mémoire : elle compte même si le stockage du téléphone la refuse. */
  private saisieMemoire: SaisieTempEau | null = null;
  /** Le coup dont le détail a été ouvert : son lien (ou « 2 autres coups ») reprend le focus au retour. */
  private rangOuvert: number | null = null;
  private readonly injector = inject(Injector);

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.detruit = true));
    // Un moment gardé qui est passé n'a plus de sens : retour sur « Maintenant ». Sinon son libellé suit le jour d'aujourd'hui.
    const gardé = this.choix.moment();
    if (gardé) {
      const maintenant = new Date();
      this.choix.moment.set(
        gardé.date.getTime() <= maintenant.getTime()
          ? null
          : { date: gardé.date, libelle: libelleMoment(gardé.date, maintenant), mention: mentionMoment(gardé.date, maintenant) },
      );
    }
    // Au retour du détail, le focus revient sur le lien du coup ouvert (« 2 autres coups » pour les coups 02 et 03).
    effect(() => {
      if (this.enfantOuvert() || this.rangOuvert === null) return;
      const rang = this.rangOuvert;
      this.rangOuvert = null;
      // L'écran est recréé : on attend son rendu avant le focus.
      afterNextRender(
        () =>
          setTimeout(() => {
            this.hostEl.nativeElement.querySelector<HTMLElement>(rang === 1 ? '#coup-1' : '#autres-coups')?.focus({ preventScroll: true });
          }),
        { injector: this.injector },
      );
    });
    // Le lieu demandé par l'écran « Spots », que la page soit créée après la navigation ou déjà vivante.
    effect(() => {
      if (this.lieuDemande.demande() === null) return;
      const spot = untracked(() => this.lieuDemande.prendre());
      if (spot) untracked(() => this.appliquerDemande(spot));
    });
    // Le focus entre dans le champ dès qu'il s'ouvre.
    effect(() => this.champTemp()?.nativeElement.focus());
  }

  protected readonly etat = signal<Etat>({ type: 'chargement' });

  protected readonly conseil = signal<EtatConseil>({ type: 'calcul' });

  private readonly selecteur = viewChild<ElementRef<HTMLButtonElement>>('selecteur');
  /** Vrai dès que la position est connue : avant, un moment choisi n'aurait aucun lieu où s'appliquer. */
  protected readonly lieuPret = signal(false);
  /** Le moment choisi ; `null` = « Maintenant ». Gardé en mémoire par le store le temps de l'app, jamais sur le téléphone. */
  private readonly moment = this.choix.moment;
  protected readonly libelleSelecteur = computed(() => this.moment()?.libelle ?? 'Maintenant');
  protected readonly feuilleOuverte = signal(false);
  protected readonly jourBrouillon = signal<JourMoment>('aujourdhui');
  protected readonly heureBrouillon = signal(0);

  /** L'espèce visée ; `null` pour « Toutes les espèces ». Gardée en mémoire par le store le temps de l'app, jamais sur le téléphone. */
  protected readonly espece = this.choix.espece;
  protected readonly choixOuvert = signal(false);
  protected readonly choixEspeces = signal<ChoixEspece[]>([]);
  private readonly bouton = viewChild.required<ElementRef<HTMLElement>>('boutonEspece');
  /** Les fiches du contenu, lues au chargement d'un moment (bandeau « Toutes les espèces ») et à l'ouverture du choix. */
  protected readonly especes = signal<Espece[]>([]);

  private lieu: Lieu | null = null;

  protected readonly preparationEnCours = signal(false);
  /** Le résultat de la dernière préparation, sous le bouton ; effacé quand le lieu change. */
  /** Le message de « Ma sortie » affiché ; seul le succès « Sortie prête » est gardé par le store pour le retour sur l'écran. */
  protected readonly messageSortie = signal<{ type: 'prete' | 'hors ligne' | 'echec'; texte: string } | null>(null);

  /** Le spot qui sert de lieu ; `null` = « Ma position ». État du composant, jamais mémorisé. */
  protected readonly spotChoisi = this.choix.spot;
  protected readonly lieuOuvert = signal(false);
  protected readonly spotsEnregistres = signal<SpotEnregistre[]>([]);
  protected readonly etatSpots = signal<EtatSpots>('chargement');
  protected readonly nomLieu = computed(() => this.spotChoisi()?.nom ?? 'Ma position');
  private readonly boutonLieu = viewChild<ElementRef<HTMLButtonElement>>('boutonLieu');
  /** Numéro du dernier choix de lieu : une position obtenue pour un choix plus ancien est ignorée. */
  private choixLieu = 0;
  /** Vrai une fois l'écran détruit : une lecture ou une préparation en retard n'écrit plus rien. */
  private detruit = false;
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

  /** Les familles du contenu (pictogrammes) ; sans elles, les coups n'ont pas de pictogramme mais restent affichés. */
  private async famillesDuContenu(): Promise<FamilleLeurre[]> {
    try {
      return await this.catalogue.famillesDeLeurres();
    } catch {
      return [];
    }
  }

  /** La zone de nage du type de leurre, lue dans le contenu ; à défaut « mi-eau », la zone du milieu. */
  private zoneDe(typeId: string, types: TypeLeurre[]): ZoneNage {
    return types.find((t) => t.id === typeId)?.zoneNage ?? 'mi-eau';
  }

  private familleDe(typeId: string, types: TypeLeurre[], familles: FamilleLeurre[]): FamilleLeurre | null {
    const famille = types.find((t) => t.id === typeId)?.famille;
    return familles.find((f) => f.id === famille) ?? null;
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

  /** Les rangs des cartes qui ont reçu un avis ; remis à zéro quand le top 3 est recalculé (un avis par carte affichée). */
  protected readonly avisDonnes = signal<ReadonlySet<number>>(new Set());
  /** Les conditions et le moment du top 3 affiché : ce que l'avis note. */
  private contexteAvis: { conditions: Conditions; moment: Date } | null = null;

  protected donnerAvis({ rang, utile }: AvisDonne): void {
    const carte = this.cartesConseil().find((c) => c.rang === rang);
    const contexte = this.contexteAvis;
    if (!carte || !contexte || this.avisDonnes().has(carte.rang)) return;
    this.avisDonnes.update((rangs) => new Set(rangs).add(carte.rang));
    this.feedback.donnerAvis(carte, utile, contexte.conditions, contexte.moment);
    // Le bouton touché disparaît : le focus passe au remerciement, que les lecteurs d'écran annoncent alors.
    afterNextRender(() => this.hostEl.nativeElement.querySelector<HTMLElement>(`#merci-${carte.rang}`)?.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  /** Ouvre le détail d'un coup (le lien garde son href pour le clic droit et les lecteurs d'écran). */
  protected ouvrirDetail({ evenement, rang }: DemandeDetail): void {
    if (!estClicSimple(evenement)) return;
    evenement.preventDefault();
    this.rangOuvert = rang;
    void this.router.navigate(['/conseil', 'detail', rang]);
  }

  protected moinsPrecis(): boolean {
    const etat = this.conseil();
    return etat.type === 'cartes' && etat.moinsPrecis;
  }

  protected limiteLegale(): string | null {
    const etat = this.conseil();
    return etat.type === 'cartes' ? etat.limite : null;
  }

  protected readonly lignes = this.detailStore.lignes;

  /** La rivière en coupe : les coups posés dans leur zone, ou le message qui les remplace. */
  protected readonly vueRiviere = computed<VueRiviere>(() => {
    if (this.etat().type === 'position introuvable') {
      return { type: 'message', texte: 'Position introuvable : autorise la localisation, ou choisis un spot dans « Lieu ».' };
    }
    const etat = this.conseil();
    switch (etat.type) {
      case 'calcul':
        return { type: 'message', texte: 'Calcul du conseil…' };
      case 'indisponible':
        return { type: 'message', texte: 'Conseil indisponible pour le moment.' };
      case 'hors heures':
        return {
          type: 'hors heures',
          titre: 'Hors des heures légales : pas de pêche aux carnassiers la nuit.',
          heures: `Heures légales ${etat.jour} : ${etat.heures}`,
        };
      case 'cartes': {
        if (etat.cartes.length === 0) return { type: 'message', texte: 'Aucun conseil pour cette espèce en ce moment.' };
        const lignes = this.lignes();
        const coups = etat.cartes.map((c, i): CoupRiviere => {
          const ligne = lignes[i];
          return {
            rang: c.rang,
            type: c.type,
            animation: c.animation,
            couleur: c.couleur,
            taille: c.taille?.valeur ?? null,
            zone: c.zone,
            famille: c.famille,
            boite: ligne ? { manque: ligne.manque, texte: libelleBoite(ligne) } : null,
          };
        });
        return { type: 'coups', coups, explications: etat.explications };
      }
    }
  });

  protected cartesConseil(): CarteConseil[] {
    const etat = this.conseil();
    return etat.type === 'cartes' ? etat.cartes : [];
  }

  protected carte(): CarteConditions | null {
    const etat = this.etat();
    return etat.type === 'pret' ? etat.carte : null;
  }

  ngOnInit(): void {
    // Un spot demandé par l'écran « Spots » est le lieu de départ : la position GPS n'est pas demandée (l'effet du constructeur l'applique).
    if (this.lieuDemande.demande() === null) void this.reprendreOuCharger();
  }

  /**
   * Retour sur l'écran (Boîte, Spots ou Compte puis « Conseil ») : le spot choisi est appliqué tout de suite (il a déjà ses coordonnées, sans
   * position GPS) et la sortie préparée dont les conditions courent encore est reprise. Le spot est ensuite vérifié en arrière-plan :
   * supprimé, retour sur « Ma position » ; renommé, son nom est mis à jour. Rien n'est écrit si l'utilisateur a choisi un autre lieu entre-temps
   * ou si l'écran est détruit.
   */
  private async reprendreOuCharger(): Promise<void> {
    const gardé = this.spotChoisi();
    const sortie = this.choix.sortiePrete();
    const chargement = gardé ? this.appliquerLieu(gardé) : this.charger();
    this.reprendreSortie(sortie); // le chargement vide l'écran, mais le lieu reste le même : le message reste vrai
    if (!gardé) return chargement;
    const numero = this.choixLieu;
    let spots: SpotEnregistre[];
    try {
      spots = await this.spots.mesSpots();
    } catch {
      return chargement; // Lecture impossible : on garde le spot choisi.
    }
    if (this.detruit || numero !== this.choixLieu) return chargement;
    const lu = spots.find((s) => s.id === gardé.id);
    if (!lu) {
      this.spotChoisi.set(null);
      return this.charger();
    }
    if (lu.lat === gardé.lat && lu.lng === gardé.lng && lu.categorie === gardé.categorie && lu.departement === gardé.departement) {
      this.spotChoisi.set(lu); // renommé : le nom suit
      return chargement;
    }
    this.spotChoisi.set(lu);
    return this.appliquerLieu(lu);
  }

  /** Remet le message « Sortie prête » d'avant le départ de l'écran, tant que ses conditions courent ; sinon l'oublie. */
  private reprendreSortie(sortie: SortiePrete | null): void {
    if (!sortie || sortie.jusquA.getTime() <= Date.now()) return;
    this.choix.sortiePrete.set(sortie);
    this.messageSortie.set({ type: 'prete', texte: sortie.texte });
  }

  /** Le spot demandé par « Voir le conseil » devient le lieu, comme un choix dans la feuille « Lieu ». */
  private appliquerDemande(spot: SpotEnregistre): void {
    this.lieuOuvert.set(false);
    this.spotChoisi.set(spot);
    void this.appliquerLieu(spot);
  }

  protected ouvrirFeuille(): void {
    const maintenant = new Date();
    const courant = jourEtHeure(this.moment()?.date ?? maintenant, maintenant);
    this.jourBrouillon.set(courant?.jour ?? 'aujourdhui');
    this.heureBrouillon.set(courant?.heure ?? 0);
    this.feuilleOuverte.set(true);
  }

  /** Ouvre un écran du dock ou de l'avatar sans recharger la page (le lien garde son href pour le clic droit et les lecteurs d'écran). */
  protected ouvrir(evenement: MouseEvent, chemin: string): void {
    // Ctrl, Cmd, Maj ou Alt-clic et clic non principal : le lien garde son comportement natif (nouvel onglet ou fenêtre).
    if (!estClicSimple(evenement)) return;
    evenement.preventDefault();
    void this.router.navigateByUrl(chemin);
  }

  /** « Préparer ma sortie » : garde les conditions des 48 h à venir du lieu affiché pour le conseil sans réseau (US 14). */
  protected async preparerSortie(): Promise<void> {
    const lieu = this.lieu;
    if (!lieu || this.preparationEnCours()) return;
    this.preparationEnCours.set(true);
    this.messageSortie.set(null);
    this.choix.sortiePrete.set(null);
    const choixLieu = this.choixLieu;
    const resultat = await this.sortie.preparer({ latitude: lieu.latitude, longitude: lieu.longitude });
    this.preparationEnCours.set(false);
    // Le lieu a changé pendant la préparation : son message ne concerne plus l'écran.
    if (this.detruit || choixLieu !== this.choixLieu) return;
    const message = messagePreparation(resultat);
    this.messageSortie.set(message);
    // Seul le succès est gardé pour le retour sur l'écran ; une erreur ne doit pas être relue à chaque retour.
    this.choix.sortiePrete.set(resultat.statut === 'prete' ? { texte: message.texte, jusquA: resultat.jusquA } : null);
  }

  protected ouvrirSaisie(): void {
    this.brouillonTemp.set('');
    this.saisieInvalide.set(false);
    this.saisieOuverte.set(true);
  }

  protected fermerSaisie(): void {
    this.fermerSaisieSansFocus();
    this.boutonThermo()?.nativeElement.focus();
  }

  protected fermerConditions(): void {
    this.conditionsOuvert.set(false);
    this.boutonConditions()?.nativeElement.focus();
  }

  protected fermerReglementation(): void {
    this.reglementationOuvert.set(false);
    this.hostEl.nativeElement.querySelector<HTMLElement>('button.etat')?.focus();
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
    this.detailStore.pourLaBoite.set(null);
    this.fermerSaisieSansFocus();
    this.conditionsOuvert.set(false);
    this.reglementationOuvert.set(false);
    this.legal.set(null);
    this.messageSortie.set(null);
    this.choix.sortiePrete.set(null);
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
    this.detailStore.pourLaBoite.set(null);
    this.fermerSaisieSansFocus();
    void this.chargerEspeces();
    this.moment.set(choisi);
    this.legal.set(null);
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
    const legale = !heures || this.pecheLegale(moment, heures, choisi !== null);
    this.legal.set(heures ? this.etatLegal(moment, heures, legale, coordonnees) : null);
    if (heures && !legale) {
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

  /** La ligne d'état réglementaire : ouverte, fermeture dans moins de 30 min, ou fermée jusqu'à la prochaine ouverture. */
  private etatLegal(moment: Date, heures: HeuresLegales, legale: boolean, coordonnees: { latitude: number; longitude: number }): EtatLegal {
    if (legale) {
      const fin = formaterHeure(heures.fin);
      const minutes = Math.max(0, Math.round((heures.fin.getTime() - moment.getTime()) / 60_000));
      return minutes <= MINUTES_AVANT_FERMETURE
        ? { type: 'fermeture', texte: `Fermeture à ${fin}, dans ${minutes} min` }
        : { type: 'ouvert', texte: `Pêche ouverte jusqu'à ${fin}` };
    }
    // Avant l'ouverture du jour, c'est elle ; sinon, celle du lendemain.
    const demain = heuresLegales(this.astro.soleil(coordonnees, new Date(moment.getTime() + 24 * UNE_HEURE_MS)));
    const ouverture = moment.getTime() < heures.debut.getTime() ? heures.debut : (demain?.debut ?? heures.debut);
    return { type: 'ferme', texte: `Pêche fermée jusqu'à ${formaterHeure(ouverture)}` };
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
    // Le moteur n'a l'entrée « unites » qu'en impérial : en métrique les conditions restent celles du relevé.
    const unites = this.unites.choix();
    if (unites === 'imperiales') conditions.unites = unites;
    this.detailStore.details.set([]);
    this.detailStore.pourLaBoite.set(null);
    this.avisDonnes.set(new Set());
    this.contexteAvis = null;
    this.conseil.set({ type: 'calcul' });
    try {
      const [resultat, types, animations, couleurs, especes, familles] = await Promise.all([
        this.moteur.conseiller(conditions, moment),
        this.catalogue.typesDeLeurres(),
        this.catalogue.animations(),
        this.catalogue.couleurs(),
        this.especesDuContenu(),
        this.famillesDuContenu(),
      ]);
      if (perime()) return;
      this.detailStore.details.set(
        resultat.conseils.map((c, i) => detailDuConseil(i + 1, c, { types, animations, couleurs, especes }, unites)),
      );
      this.detailStore.toutesEspeces.set(cible === null);
      this.detailStore.pourLaBoite.set({ conseils: resultat.conseils, types, couleurs });
      const cartes = resultat.conseils.map((c, i): CarteConseil => ({
        rang: i + 1,
        typeId: c.typeId,
        techniqueId: c.techniqueId,
        type: types.find((t) => t.id === c.typeId)?.nom ?? c.typeId,
        animation: animations.find((a) => a.id === c.techniqueId)?.nom ?? c.techniqueId,
        couleur: couleurs.find((x) => x.id === c.couleur)?.nom ?? c.couleur,
        taille: c.taille
          ? { libelle: libelleTaille(c.taille), valeur: formaterTaille(c.taille, unites) }
          : null,
        zone: this.zoneDe(c.typeId, types),
        famille: this.familleDe(c.typeId, types, familles),
      }));
      this.contexteAvis = { conditions: releve.conditions, moment };
      this.conseil.set({ type: 'cartes', cartes, moinsPrecis: releve.moinsPrecis || releve.conditions.sourceTempEau === 'estimation',
        limite,
        explications: (resultat.explications ?? []).map(finirParUnPoint),
      });
      this.mesure.envoyer('conseil_affiche', { espece: cible?.code ?? 'toutes', nombre: resultat.conseils.length });
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
      eau: formaterTempEau(conditions.tempEau, this.unites.choix()),
      sourceEau: formaterSourceTempEau(releve),
      debit: formaterDebit(releve),
      pression: formaterPression(releve.pressionHpa, conditions.pressionTendance48h),
      ciel: formaterCiel(conditions.nuages),
      vent: formaterVent(conditions.vent),
      meteo: formaterMeteo(conditions.nuages, conditions.vent),
      lune,
      heuresLegales: heures,
    };
  }
}
