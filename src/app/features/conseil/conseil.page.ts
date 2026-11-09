import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService, Federation } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService } from '../../core/data/position.service';
import { dansHeuresLegales, HeuresLegales, heuresLegales } from '../../core/regulation/legal-hours';
import { BandeauReglementationComponent } from './bandeau-reglementation.component';
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
import { formaterTaille, libelleTaille, premierePhrase } from './conseil-format';
import {
  JourMoment,
  jourEtHeure,
  libelleMoment,
  mentionMoment,
  motDuJour,
} from './moment-format';

const UNE_HEURE_MS = 3600 * 1000;

/** Le moment affiché ; `null` = « Maintenant ». Le libellé et la mention sont figés au choix. */
interface MomentChoisi {
  date: Date;
  libelle: string;
  mention: string;
}

interface Lieu {
  latitude: number;
  longitude: number;
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
}

/** Une carte de conseil, déjà traduite en noms et formatée. */
interface CarteConseil {
  rang: number;
  type: string;
  animation: string;
  couleur: string;
  taille: { libelle: string; valeur: string } | null;
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

@Component({
  selector: 'app-conseil',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BandeauReglementationComponent, MomentFeuilleComponent],
  host: { class: 'ion-page' },
  styles: `
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
    .selecteur {
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
    .selecteur .lib {
      display: block;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .selecteur .val {
      font-size: 17px;
      font-weight: 700;
    }
    .selecteur .chevron {
      font-size: 22px;
      color: var(--lr-primaire);
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
    <ion-header>
      <ion-toolbar>
        <ion-title>Conseil</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
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
            @for (c of cartesConseil(); track c.rang) {
              <article class="carte conseil">
                <div class="entete">
                  <span class="rang">{{ c.rang }}</span>
                  <h3>{{ c.type }}</h3>
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
                </dl>
                <p class="pourquoi">{{ c.pourquoi }}</p>
              </article>
            }
          }
        }
      }
      @if (carte(); as c) {
        <app-bandeau-reglementation
          [categorie]="null"
          [espece]="null"
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
  `,
})
export class ConseilPage implements OnInit {
  private readonly position = inject(PositionService);
  private readonly conditions = inject(ConditionsService);
  private readonly astro = inject(AstroService);
  private readonly catalogue = inject(CatalogService);
  private readonly moteur = inject(MoteurService);

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

  private lieu: Lieu | null = null;
  /** Numéro du dernier calcul demandé : un résultat plus ancien est ignoré. */
  private calcul = 0;

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

  /** Lieu = position GPS (demandée une seule fois), moment = maintenant. */
  private async charger(): Promise<void> {
    const position = await this.position.positionGps();
    if (!position.disponible) {
      this.etat.set({ type: 'position introuvable' });
      return;
    }
    this.lieuPret.set(true);
    this.lieu = { latitude: position.latitude, longitude: position.longitude };
    await this.chargerMoment(new Date(), null);
  }

  /** Recalcule conditions, heures légales et top 3 pour ce moment. Un choix plus récent l'emporte. */
  private async chargerMoment(moment: Date, choisi: MomentChoisi | null): Promise<void> {
    const lieu = this.lieu;
    if (!lieu) return;
    const numero = ++this.calcul;
    const perime = () => numero !== this.calcul;
    this.moment.set(choisi);
    this.etat.set({ type: 'chargement' });
    this.conseil.set({ type: 'calcul' });
    const releve = await this.conditions.releve({ lieu, moment });
    if (perime()) return;
    const heures = heuresLegales(this.astro.soleil(lieu, moment));
    const federation = await this.catalogue.federation(releve.conditions.departement);
    if (perime()) return;
    const texteHeures = heures ? formaterHeuresLegales(heures.debut, heures.fin) : 'Indisponible';
    this.etat.set({
      type: 'pret',
      carte: {
        ...this.composer(releve, this.astro.lune(moment, lieu).phase, texteHeures),
        prevision: choisi ? `Prévisions pour ${choisi.mention}` : undefined,
        federation,
        date: moment,
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
    await this.chargerConseil(releve, moment, limite, perime);
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
    perime: () => boolean,
  ): Promise<void> {
    try {
      const [resultat, types, animations, couleurs] = await Promise.all([
        this.moteur.conseiller(releve.conditions, moment),
        this.catalogue.typesDeLeurres(),
        this.catalogue.animations(),
        this.catalogue.couleurs(),
      ]);
      if (perime()) return;
      const cartes = resultat.conseils.map((c, i): CarteConseil => ({
        rang: i + 1,
        type: types.find((t) => t.id === c.typeId)?.nom ?? c.typeId,
        animation: animations.find((a) => a.id === c.techniqueId)?.nom ?? c.techniqueId,
        couleur: couleurs.find((x) => x.id === c.couleur)?.nom ?? c.couleur,
        taille: c.taille
          ? { libelle: libelleTaille(c.taille), valeur: formaterTaille(c.taille) }
          : null,
        pourquoi: premierePhrase(c.pourquoi[0] ?? ''),
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
  ): Omit<CarteConditions, 'federation' | 'date' | 'prevision'> {
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
