import { Component, inject, OnInit, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { CatalogService, Espece } from '../../core/data/catalog.service';
import { SOURCE_COMPTE } from '../../core/data/compte.service';
import { ChoixOnboarding, OnboardingStore } from '../../core/data/onboarding.store';
import { SOURCE_PROFIL } from '../../core/data/profil.service';
import { BoutonRetourComponent } from '../../shared/bouton-retour/bouton-retour.component';
import { CHOIX_UNITES, UnitesService } from '../../shared/unites.service';

type Niveau = ChoixOnboarding['niveau'];

const NIVEAUX: { valeur: Niveau; libelle: string; precision: string }[] = [
  { valeur: 'debutant', libelle: 'Débutant', precision: 'Je débute au leurre' },
  { valeur: 'intermediaire', libelle: 'Intermédiaire', precision: "J'ai déjà pris des carnassiers au leurre" },
];

/**
 * « Préférences » (US 93, PLAN §3, §4, §7) : espèces favorites, niveau et unités. Chaque choix s'applique tout de suite : la copie de
 * l'appareil (lue par le moteur) est mise à jour, puis `users/{uid}` (niveau et espèces) ; les unités restent sur l'appareil (décision U1).
 * Hors ligne, l'écriture attend le retour du réseau et la page le dit.
 */
@Component({
  selector: 'app-preferences',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BoutonRetourComponent],
  host: { class: 'ion-page' },
  styles: `
    .titre-groupe {
      margin: 16px 0 6px 4px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--lr-texte-secondaire);
    }
    .titre-groupe:first-child {
      margin-top: 0;
    }
    .groupe {
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      overflow: hidden;
    }
    label {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 52px;
      padding: 10px 16px;
      border-top: 1px solid var(--lr-bordure);
      font-size: 17px;
      cursor: pointer;
    }
    label:first-child {
      border-top: none;
    }
    input {
      position: absolute;
      opacity: 0;
    }
    label:has(input:focus-visible) {
      outline: 2px solid var(--lr-primaire);
      outline-offset: -2px;
    }
    .marque {
      flex: none;
      box-sizing: border-box;
      width: 24px;
      height: 24px;
      border: 2px solid var(--lr-bordure);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .marque.ronde {
      border-radius: 50%;
    }
    input:checked + .marque {
      border-color: var(--lr-primaire);
      background: var(--lr-primaire);
    }
    input:checked + .marque::after {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--lr-fond);
    }
    input[type='checkbox']:checked + .marque::after {
      width: 5px;
      height: 10px;
      border-radius: 0;
      background: none;
      border: solid var(--lr-fond);
      border-width: 0 2px 2px 0;
      transform: rotate(45deg) translate(-1px, -1px);
    }
    .precision {
      display: block;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .attente {
      margin: 16px 4px 0;
      font-size: 15px;
      line-height: 1.45;
      color: var(--lr-texte-secondaire);
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <app-bouton-retour slot="start" libelle="Compte" />
        <ion-title>Préférences</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h2 class="titre-groupe">Tes espèces préférées</h2>
      <div class="groupe">
        @for (e of especes(); track e.code) {
          <label>
            <input type="checkbox" [checked]="choix().especesFavorites.includes(e.code)" (change)="basculerEspece(e.code)" />
            <span class="marque" aria-hidden="true"></span>{{ e.nom }}
          </label>
        }
      </div>
      <h2 class="titre-groupe">Ton niveau</h2>
      <div class="groupe" role="radiogroup" aria-label="Ton niveau">
        @for (n of niveaux; track n.valeur) {
          <label>
            <input type="radio" name="niveau" [value]="n.valeur" [checked]="choix().niveau === n.valeur" (change)="choisirNiveau(n.valeur)" />
            <span class="marque ronde" aria-hidden="true"></span>
            <span>
              {{ n.libelle }}
              <span class="precision">{{ n.precision }}</span>
            </span>
          </label>
        }
      </div>
      <h2 class="titre-groupe">Unités</h2>
      <div class="groupe" role="radiogroup" aria-label="Unités">
        @for (u of unites; track u.valeur) {
          <label>
            <input type="radio" name="unites" [value]="u.valeur" [checked]="systeme.choix() === u.valeur" (change)="systeme.choisir(u.valeur)" />
            <span class="marque ronde" aria-hidden="true"></span>
            <span>{{ u.libelle }}</span>
          </label>
        }
      </div>
      @if (enAttente() > 0) {
        <p class="attente">Pas encore synchronisé : ce sera fait au retour du réseau.</p>
      }
    </ion-content>
  `,
})
export class PreferencesPage implements OnInit {
  private readonly catalogue = inject(CatalogService);
  private readonly onboarding = inject(OnboardingStore);
  private readonly compte = inject(SOURCE_COMPTE);
  private readonly profil = inject(SOURCE_PROFIL);
  protected readonly systeme = inject(UnitesService);

  protected readonly niveaux = NIVEAUX;
  protected readonly unites = CHOIX_UNITES;
  /** Les espèces du contenu, dans son ordre. */
  protected readonly especes = signal<Espece[]>([]);
  protected readonly choix = signal<ChoixOnboarding>(this.onboarding.lire() ?? { niveau: 'debutant', especesFavorites: [] });
  /** Nombre d'écritures dans `users/{uid}` pas encore acquittées par le serveur. */
  protected readonly enAttente = signal(0);

  ngOnInit(): void {
    void this.catalogue.especes().then((especes) => this.especes.set(especes));
  }

  protected choisirNiveau(niveau: Niveau): void {
    this.appliquer({ ...this.choix(), niveau }, { niveau });
  }

  protected basculerEspece(code: string): void {
    const cochees = new Set(this.choix().especesFavorites);
    if (!cochees.delete(code)) cochees.add(code);
    // Dans l'ordre du contenu, comme à l'onboarding.
    const especesFavorites = this.especes().map((e) => e.code).filter((c) => cochees.has(c));
    this.appliquer({ ...this.choix(), especesFavorites }, { especesFavorites });
  }

  /** Applique tout de suite sur l'appareil (le moteur lit cette copie), puis envoie au profil. */
  private appliquer(suivant: ChoixOnboarding, champs: Partial<ChoixOnboarding>): void {
    this.choix.set(suivant);
    this.onboarding.terminer(suivant);
    void this.synchroniser(champs);
  }

  /** Sans compte, rien n'est écrit : les choix valent sur l'appareil. Hors ligne, la promesse reste en attente jusqu'au retour du réseau. */
  private async synchroniser(champs: Partial<ChoixOnboarding>): Promise<void> {
    try {
      const uid = await this.compte.uidCourant();
      if (uid === null) return;
      this.enAttente.update((n) => n + 1);
      try {
        await this.profil.mettreAJour(uid, champs);
      } finally {
        this.enAttente.update((n) => n - 1);
      }
    } catch (erreur) {
      console.warn("Les préférences n'ont pas pu être envoyées au profil.", erreur);
    }
  }
}
