import { Component, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { CatalogService } from '../../core/data/catalog.service';
import { BoutonRetourComponent } from '../../shared/bouton-retour/bouton-retour.component';
import { collecterSources, FICHIERS_CONTENU, morceauxDeSource } from './sources-contenu';

interface GroupeSources {
  libelle: string;
  sources: { morceaux: ReturnType<typeof morceauxDeSource> }[];
}

/** « À propos et sources » (US 91, PLAN §3, §9) : les services de données, puis les `sources` des fichiers de contenu, lues à l'exécution. */
@Component({
  selector: 'app-a-propos',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BoutonRetourComponent],
  host: { class: 'ion-page' },
  styles: `
    .intro {
      margin: 0 0 14px;
      font-size: 16px;
      line-height: 1.45;
      color: var(--lr-texte);
    }
    .titre-groupe {
      margin: 16px 0 6px 4px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--lr-texte-secondaire);
    }
    .bloc {
      margin: 0 0 12px;
      padding: 14px 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    h2 {
      margin: 0 0 4px;
      font-size: 17px;
    }
    .bloc p {
      margin: 0;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    a {
      color: var(--lr-primaire);
    }
    .bloc a {
      display: inline-flex;
      align-items: center;
      min-height: 48px;
    }
    .groupes {
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      overflow: hidden;
    }
    details + details {
      border-top: 1px solid var(--lr-bordure);
    }
    summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 52px;
      padding: 0 16px;
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
    }
    .nombre {
      font-size: 15px;
      font-weight: 400;
      color: var(--lr-texte-secondaire);
    }
    ul {
      margin: 0;
      padding: 0 16px 12px;
      list-style: none;
      font-size: 14px;
      line-height: 1.4;
    }
    li {
      padding: 8px 0;
      border-top: 1px solid var(--lr-bordure);
      overflow-wrap: anywhere;
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <app-bouton-retour slot="start" libelle="Compte" />
        <ion-title>À propos et sources</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p class="intro">
        Leurio conseille un leurre et une animation selon l’eau, la météo et la saison. Voici d’où viennent ses données.
      </p>
      <h2 class="titre-groupe">Données en direct</h2>
      <section class="bloc">
        <h3>Hub’Eau</h3>
        <p>
          Température et débit des rivières (Office français de la biodiversité, BRGM).
          <a href="https://hubeau.eaufrance.fr" target="_blank" rel="noopener">hubeau.eaufrance.fr</a>
        </p>
      </section>
      <section class="bloc">
        <h3>Open-Meteo</h3>
        <p>
          Météo : pression, nuages, vent, températures de l’air.
          <a href="https://open-meteo.com" target="_blank" rel="noopener">open-meteo.com</a>
        </p>
      </section>
      <section class="bloc">
        <h3>OpenStreetMap</h3>
        <p>
          Fond de la carte des spots. © les contributrices et contributeurs d’OpenStreetMap.
          <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">openstreetmap.org</a>
        </p>
      </section>
      <h2 class="titre-groupe">Contenu de l’app (leurres, animations, espèces, réglementation)</h2>
      <div class="groupes">
        @for (groupe of groupes(); track groupe.libelle) {
          <details>
            <summary>
              <span>{{ groupe.libelle }}</span>
              <span class="nombre">{{ groupe.sources.length }} {{ groupe.sources.length > 1 ? 'sources' : 'source' }}</span>
            </summary>
            <ul>
              @for (source of groupe.sources; track $index) {
                <li>
                  @for (m of source.morceaux; track $index) {
                    @if (m.url; as url) {<a [href]="url" target="_blank" rel="noopener">{{ m.texte }}</a>} @else {<span>{{ m.texte }}</span>}
                  }
                </li>
              }
            </ul>
          </details>
        }
      </div>
    </ion-content>
  `,
})
export class AProposPage {
  private readonly catalogue = inject(CatalogService);

  protected readonly groupes = signal<GroupeSources[]>([]);

  constructor() {
    void this.charger();
  }

  /** Un fichier qui ne se charge pas est simplement absent de la liste (PLAN §4 : une source indisponible ne bloque rien). */
  private async charger(): Promise<void> {
    const groupes = await Promise.all(
      FICHIERS_CONTENU.map(async ({ fichier, libelle }): Promise<GroupeSources | null> => {
        try {
          const sources = collecterSources(await this.catalogue.contenuBrut(fichier));
          return sources.length === 0 ? null : { libelle, sources: sources.map((s) => ({ morceaux: morceauxDeSource(s) })) };
        } catch {
          return null;
        }
      }),
    );
    this.groupes.set(groupes.filter((g): g is GroupeSources => g !== null));
  }
}
