import { Component, inject, OnInit, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService, Federation } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService } from '../../core/data/position.service';
import { dansHeuresLegales, heuresLegales } from '../../core/regulation/legal-hours';
import { BandeauReglementationComponent } from './bandeau-reglementation.component';
import {
  formaterCiel,
  formaterDebit,
  formaterHeuresLegales,
  formaterPression,
  formaterSourceTempEau,
  formaterTempEau,
  formaterVent,
} from './conditions-format';
import { formaterTaille, libelleTaille, premierePhrase } from './conseil-format';

/** Ce que la carte « Conditions » affiche, déjà formaté. */
interface CarteConditions {
  mention?: string;
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
  | { type: 'cartes'; cartes: CarteConseil[]; moinsPrecis: boolean }
  | { type: 'hors heures'; heures: string }
  | { type: 'indisponible' };

type Etat =
  | { type: 'chargement' }
  | { type: 'position introuvable' }
  | { type: 'pret'; carte: CarteConditions };

@Component({
  selector: 'app-conseil',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BandeauReglementationComponent],
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
              <p class="message">Heures légales aujourd'hui : {{ heuresDuJour() }}</p>
            </section>
          }
          @default {
            @if (moinsPrecis()) {
              <p><span class="badge">Conseil moins précis</span></p>
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
  private readonly heures = signal('');

  protected heuresDuJour(): string {
    return this.heures();
  }

  protected moinsPrecis(): boolean {
    const etat = this.conseil();
    return etat.type === 'cartes' && etat.moinsPrecis;
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

  /** Lieu = position GPS, moment = maintenant. */
  private async charger(): Promise<void> {
    const position = await this.position.positionGps();
    if (!position.disponible) {
      this.etat.set({ type: 'position introuvable' });
      return;
    }
    const lieu = { latitude: position.latitude, longitude: position.longitude };
    const maintenant = new Date();
    const releve = await this.conditions.releve({ lieu, moment: maintenant });
    const heures = heuresLegales(this.astro.soleil(lieu, maintenant));
    const federation = await this.catalogue.federation(releve.conditions.departement);
    const texteHeures = heures ? formaterHeuresLegales(heures.debut, heures.fin) : 'Indisponible';
    this.etat.set({
      type: 'pret',
      carte: {
        ...this.composer(releve, this.astro.lune(maintenant, lieu).phase, texteHeures),
        federation,
        date: maintenant,
      },
    });
    if (heures && !dansHeuresLegales(maintenant, heures)) {
      this.heures.set(texteHeures);
      this.conseil.set({ type: 'hors heures', heures: texteHeures });
      return;
    }
    await this.chargerConseil(releve, maintenant);
  }

  /** Le top 3 du moteur. Une panne du moteur ou du contenu n'abîme ni la carte « Conditions » ni le bandeau. */
  private async chargerConseil(releve: ReleveActuel, moment: Date): Promise<void> {
    try {
      const [resultat, types, animations, couleurs] = await Promise.all([
        this.moteur.conseiller(releve.conditions, moment),
        this.catalogue.typesDeLeurres(),
        this.catalogue.animations(),
        this.catalogue.couleurs(),
      ]);
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
      this.conseil.set({ type: 'cartes', cartes, moinsPrecis: releve.moinsPrecis });
    } catch {
      this.conseil.set({ type: 'indisponible' });
    }
  }

  private composer(
    releve: ReleveActuel,
    lune: string,
    heures: string,
  ): Omit<CarteConditions, 'federation' | 'date'> {
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
