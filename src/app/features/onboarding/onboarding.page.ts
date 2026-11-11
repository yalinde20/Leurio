import { afterNextRender, Component, ElementRef, inject, Injector, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogService, Espece } from '../../core/data/catalog.service';
import { ChoixOnboarding, OnboardingStore } from '../../core/data/onboarding.store';
import { PositionService } from '../../core/data/position.service';

type Niveau = ChoixOnboarding['niveau'];

const TITRES = ['Leurio, ton conseil de pêche au leurre', 'Tes espèces et ton niveau', 'Pourquoi ta position ?'];
const NIVEAUX: { valeur: Niveau; libelle: string; precision: string }[] = [
  { valeur: 'debutant', libelle: 'Débutant', precision: 'Je débute au leurre' },
  { valeur: 'intermediaire', libelle: 'Intermédiaire', precision: "J'ai déjà pris des carnassiers au leurre" },
];

/** L'onboarding en 3 pages, plein écran, au premier lancement (PLAN §3). Les choix ne sont gardés qu'à la fin de la page 3. */
@Component({
  selector: 'app-onboarding',
  host: { class: 'ion-page' },
  styles: `
    :host {
      background: var(--lr-fond);
      color: var(--lr-texte);
    }
    .ob {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom));
    }
    .points {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-bottom: 24px;
    }
    .points span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--lr-bordure);
    }
    .points span.on {
      width: 24px;
      border-radius: 4px;
      background: var(--lr-primaire);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.15;
    }
    h1:focus {
      outline: none;
    }
    .intro {
      margin: 0 0 16px;
      font-size: 17px;
      line-height: 1.4;
    }
    ul.puces {
      margin: 0 0 20px;
      padding: 0;
      list-style: none;
    }
    ul.puces li {
      display: flex;
      gap: 12px;
      padding: 10px 0;
      border-top: 1px solid var(--lr-bordure);
      font-size: 16px;
      line-height: 1.35;
    }
    ul.puces li:first-child {
      border-top: none;
    }
    .ico {
      flex: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--lr-sable);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
    }
    .carte-peche {
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--lr-surface);
      border: 1px solid var(--lr-bordure);
      font-size: 16px;
    }
    .carte-peche p {
      margin: 0;
      font-weight: 600;
    }
    .lien {
      display: inline-flex;
      align-items: center;
      min-height: 48px;
      min-width: 48px;
      color: var(--lr-primaire);
      font-weight: 600;
      font-size: 16px;
      text-decoration: underline;
    }
    .bas {
      margin-top: auto;
      padding-top: 20px;
    }
    .bouton,
    .bouton-sec {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 48px;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 600;
      font-family: inherit;
    }
    .bouton {
      border: none;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
    }
    .bouton-sec {
      margin-top: 10px;
      border: 1px solid var(--lr-primaire);
      background: transparent;
      color: var(--lr-primaire);
    }
    fieldset {
      border: none;
      margin: 0 0 16px;
      padding: 0;
    }
    legend {
      margin-bottom: 4px;
      padding: 0;
      font-size: 18px;
      font-weight: 700;
    }
    .aide {
      margin: 0 0 8px;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .cases {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .niveaux {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .case {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 0 12px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-surface);
      font-size: 16px;
    }
    .niveaux .case {
      min-height: 56px;
    }
    .case[aria-checked='true'] {
      border-color: var(--lr-primaire);
    }
    .box {
      flex: none;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 2px solid var(--lr-bordure);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 800;
    }
    .box.rond {
      border-radius: 50%;
    }
    .case[aria-checked='true'] .box {
      background: var(--lr-primaire);
      border-color: var(--lr-primaire);
      color: var(--lr-sur-primaire);
    }
    .case[aria-checked='true'] .box:not(.rond)::after {
      content: '✓';
    }
    .case[aria-checked='true'] .box.rond::after {
      content: '●';
    }
    .sous {
      display: block;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .niveaux.invalide .case {
      border: 2px solid var(--lr-danger);
    }
    .erreur {
      margin: 8px 0 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-danger);
    }
  `,
  template: `
    <div class="ob">
      <div class="points" [attr.aria-label]="'Page ' + (page() + 1) + ' sur 3'">
        @for (n of [0, 1, 2]; track n) {
          <span [class.on]="n === page()"></span>
        }
      </div>
      <h1 #titre tabindex="-1">{{ titres[page()] }}</h1>

      @switch (page()) {
        @case (0) {
          <p class="intro">
            Dis-nous où et quand tu pêches : Leurio te dit quel leurre et quelle animation utiliser, maintenant, ici.
          </p>
          <ul class="puces">
            <li>
              <span class="ico" aria-hidden="true">1</span
              ><span>Il lit les conditions : température de l'eau, débit, météo, soleil et lune.</span>
            </li>
            <li>
              <span class="ico" aria-hidden="true">2</span
              ><span>Il te donne un top 3 de leurres, avec l'animation et le pourquoi.</span>
            </li>
            <li>
              <span class="ico" aria-hidden="true">3</span><span>Il te rappelle la réglementation de l'eau douce.</span>
            </li>
          </ul>
          <div class="carte-peche">
            <p>La carte de pêche est obligatoire.</p>
            <a class="lien" href="https://www.cartedepeche.fr" target="_blank" rel="noopener">cartedepeche.fr</a>
          </div>
          <div class="bas"><button type="button" class="bouton" (click)="suivant()">Suivant</button></div>
        }
        @case (1) {
          <fieldset>
            <legend>Tes espèces préférées</legend>
            <p class="aide">Facultatif. Tu pourras les changer dans Compte.</p>
            <div class="cases">
              @for (espece of especes(); track espece.code) {
                <div
                  class="case"
                  role="checkbox"
                  tabindex="0"
                  [attr.aria-checked]="especesCochees().includes(espece.code)"
                  (click)="basculer(espece.code)"
                  (keydown.space)="basculer(espece.code); $event.preventDefault()"
                  (keydown.enter)="basculer(espece.code)"
                >
                  <span class="box" aria-hidden="true"></span>{{ espece.nom }}
                </div>
              }
            </div>
          </fieldset>
          <fieldset>
            <legend id="legende-niveau">Ton niveau</legend>
            <div class="niveaux" [class.invalide]="niveauManquant()" role="radiogroup" aria-labelledby="legende-niveau">
              @for (n of niveaux; track n.valeur) {
                <div
                  class="case"
                  role="radio"
                  tabindex="0"
                  [attr.aria-checked]="niveau() === n.valeur"
                  (click)="choisirNiveau(n.valeur)"
                  (keydown.space)="choisirNiveau(n.valeur); $event.preventDefault()"
                  (keydown.enter)="choisirNiveau(n.valeur)"
                >
                  <span class="box rond" aria-hidden="true"></span>
                  <span>{{ n.libelle }}&ngsp;<span class="sous">{{ n.precision }}</span></span>
                </div>
              }
            </div>
            @if (niveauManquant()) {
              <p class="erreur" role="alert">Choisis ton niveau.</p>
            }
          </fieldset>
          <div class="bas"><button type="button" class="bouton" (click)="suivant()">Suivant</button></div>
        }
        @case (2) {
          <p class="intro">Leurio a besoin de savoir où tu pêches pour te conseiller juste.</p>
          <ul class="puces">
            <li>
              <span class="ico" aria-hidden="true">☁</span><span>La météo et la température de l'eau près de toi.</span>
            </li>
            <li>
              <span class="ico" aria-hidden="true">☀</span
              ><span>Les heures légales de pêche, calculées avec le soleil.</span>
            </li>
            <li><span class="ico" aria-hidden="true">⚖</span><span>La réglementation de ton département.</span></li>
          </ul>
          <p class="aide">Ta position n'est montrée à personne. Sans elle, tu peux choisir un de tes spots.</p>
          <div class="bas">
            <button type="button" class="bouton" (click)="autoriser()">Autoriser la localisation</button>
            <button type="button" class="bouton-sec" (click)="plusTard()">Plus tard</button>
          </div>
        }
      }
    </div>
  `,
})
export class OnboardingPage implements OnInit {
  private readonly catalogue = inject(CatalogService);
  private readonly position = inject(PositionService);
  private readonly store = inject(OnboardingStore);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly titre = viewChild.required<ElementRef<HTMLElement>>('titre');

  protected readonly titres = TITRES;
  protected readonly niveaux = NIVEAUX;
  protected readonly page = signal(0);
  protected readonly especes = signal<Espece[]>([]);
  protected readonly especesCochees = signal<string[]>([]);
  protected readonly niveau = signal<Niveau | null>(null);
  protected readonly niveauManquant = signal(false);
  private termine = false;

  ngOnInit(): void {
    void this.catalogue.especes().then((especes) => this.especes.set(especes));
  }

  protected basculer(code: string): void {
    this.especesCochees.update((codes) => (codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]));
  }

  protected choisirNiveau(niveau: Niveau): void {
    this.niveau.set(niveau);
    this.niveauManquant.set(false);
  }

  protected suivant(): void {
    if (this.page() === 1 && this.niveau() === null) {
      this.niveauManquant.set(true);
      return;
    }
    this.page.update((p) => p + 1);
    // Le titre de la nouvelle page reçoit le focus : le lecteur d'écran l'annonce.
    afterNextRender(() => this.titre().nativeElement.focus(), { injector: this.injector });
  }

  /** Seule la page 3 peut déclencher la demande du téléphone. Quelle que soit la réponse, on arrive sur « Conseil ». */
  protected async autoriser(): Promise<void> {
    if (this.termine) return;
    this.termine = true;
    await this.position.positionGps();
    this.terminer();
  }

  protected plusTard(): void {
    if (this.termine) return;
    this.termine = true;
    this.store.localisationDifferee = true;
    this.terminer();
  }

  private terminer(): void {
    // Le bouton « Suivant » de la page 2 garantit un niveau choisi ici.
    const niveau = this.niveau();
    if (niveau === null) return;
    // Dans l'ordre du contenu, pas dans l'ordre des touches.
    const especesFavorites = this.especes()
      .map((e) => e.code)
      .filter((code) => this.especesCochees().includes(code));
    this.store.terminer({ niveau, especesFavorites });
    void this.router.navigateByUrl('/conseil', { replaceUrl: true });
  }
}
