import { Component, inject, OnInit, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService, Federation } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { PositionService } from '../../core/data/position.service';
import { heuresLegales } from '../../core/regulation/legal-hours';
import {
  formaterCiel,
  formaterDebit,
  formaterHeuresLegales,
  formaterPression,
  formaterSourceTempEau,
  formaterTempEau,
  formaterVent,
} from './conditions-format';

/** Ce que la carte « Conditions » affiche, déjà formaté. */
interface CarteConditions {
  mention?: string;
  eau: string;
  sourceEau: string | null;
  debit: string;
  pression: string;
  ciel: string;
  vent: string;
  lune: string;
  heuresLegales: string;
  federation?: Federation;
}

type Etat =
  | { type: 'chargement' }
  | { type: 'position introuvable' }
  | { type: 'pret'; carte: CarteConditions };

@Component({
  selector: 'app-conseil',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
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
              @if (c.mention) {
                <p class="mention">{{ c.mention }}</p>
              }
              <dl>
                <div class="ligne eau">
                  <dt>Température de l'eau :</dt>
                  <dd>{{ c.eau }}</dd>
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
    </ion-content>
  `,
})
export class ConseilPage implements OnInit {
  private readonly position = inject(PositionService);
  private readonly conditions = inject(ConditionsService);
  private readonly astro = inject(AstroService);
  private readonly catalogue = inject(CatalogService);

  protected readonly etat = signal<Etat>({ type: 'chargement' });

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
    this.etat.set({
      type: 'pret',
      carte: {
        ...this.composer(
          releve,
          this.astro.lune(maintenant, lieu).phase,
          heures ? formaterHeuresLegales(heures.debut, heures.fin) : 'Indisponible',
        ),
        federation,
      },
    });
  }

  private composer(releve: ReleveActuel, lune: string, heures: string): CarteConditions {
    const { conditions } = releve;
    return {
      mention: releve.mention,
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
