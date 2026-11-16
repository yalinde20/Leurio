import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { CompteLie, FournisseurLiaison, SOURCE_LIAISON } from '../../core/data/liaison-compte';
import { CHOIX_THEME, ThemeService } from '../../shared/theme.service';

type MessageLiaison = 'deja-associe' | 'hors-ligne' | 'echec' | 'email-invalide' | 'mot-de-passe-court' | 'adresse-utilisee';

const MOT_DE_PASSE_MIN = 6;
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ANNULATIONS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

/** Le message à montrer pour une erreur de liaison ; `null` quand l'utilisateur a simplement fermé la fenêtre. */
function messagePourErreur(code: string | undefined): MessageLiaison | null {
  if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') return 'deja-associe';
  if (code === 'auth/network-request-failed') return 'hors-ligne';
  if (code && ANNULATIONS.includes(code)) return null;
  return 'echec';
}

/** Le message à montrer pour une erreur de liaison par e-mail (US 96). */
function messagePourErreurEmail(code: string | undefined): MessageLiaison {
  if (code === 'auth/email-already-in-use') return 'adresse-utilisee';
  if (code === 'auth/invalid-email') return 'email-invalide';
  if (code === 'auth/weak-password') return 'mot-de-passe-court';
  if (code === 'auth/network-request-failed') return 'hors-ligne';
  return 'echec';
}

@Component({
  selector: 'app-compte',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, RouterLink, RouterOutlet],
  host: { class: 'ion-page' },
  styles: `
    /* Dès que la page enfant est dans le DOM (avant le prochain passage de détection de changements), l'écran « Compte » lui laisse la place. */
    :host:has(> router-outlet + *) > ion-header,
    :host:has(> router-outlet + *) > ion-content {
      display: none;
    }
    .titre-groupe {
      margin: 0 0 6px 4px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--lr-texte-secondaire);
    }
    .groupe {
      margin: 0 0 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      overflow: hidden;
    }
    .rangee {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 52px;
      padding: 10px 16px;
      border-top: 1px solid var(--lr-bordure);
      font-size: 17px;
      color: var(--lr-texte);
      text-decoration: none;
    }
    .rangee:first-child {
      border-top: none;
    }
    .chevron {
      font-size: 22px;
      color: var(--lr-texte-secondaire);
    }
    .valeur {
      margin-left: auto;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .sous {
      display: block;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .externe {
      flex: none;
      white-space: nowrap;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-primaire);
    }
    .compte {
      margin: 0 0 16px;
      padding: 14px 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
    }
    .compte h3 {
      margin: 0 0 4px;
      font-size: 17px;
      font-weight: 700;
    }
    .compte p {
      margin: 0;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .compte .adresse {
      margin-top: 2px;
      font-size: 16px;
      color: var(--lr-texte);
      overflow-wrap: anywhere;
    }
    .compte .lien-donnees {
      margin-top: 6px;
    }
    .fournisseur {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 48px;
      margin-top: 12px;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 600;
      font-family: inherit;
    }
    .fournisseur.apple {
      background: var(--lr-texte);
      color: var(--lr-fond);
      border: 1px solid var(--lr-texte);
    }
    .fournisseur.google {
      background: var(--lr-surface);
      color: var(--lr-texte);
      border: 1px solid var(--lr-bordure);
    }
    .fournisseur.email {
      background: var(--lr-surface);
      color: var(--lr-texte);
      border: 1px solid var(--lr-bordure);
    }
    .champ {
      display: block;
      margin-top: 12px;
    }
    .champ .libelle {
      display: block;
      margin: 0 0 4px 2px;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-texte);
    }
    .champ input {
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      padding: 0 12px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-fond);
      color: var(--lr-texte);
      font-size: 17px;
      font-family: inherit;
    }
    .champ input.en-erreur {
      border-color: var(--lr-danger);
    }
    .champ .aide {
      display: block;
      margin: 4px 0 0 2px;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .fournisseur.principal {
      border: none;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
    }
    .fournisseur:disabled {
      opacity: 0.5;
    }
    .compte .en-cours {
      margin-top: 10px;
    }
    .compte .erreur {
      margin-top: 10px;
      font-weight: 600;
      color: var(--lr-danger);
    }
    .compte .info {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--lr-sable);
      color: var(--lr-texte);
    }
  `,
  template: `
    @if (!enfantOuvert()) {
      <ion-header>
        <ion-toolbar>
          <ion-title>Compte</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        @if (!natif) {
        <h2 class="titre-groupe">Ton compte</h2>
        <div class="compte">
          @if (compteLie(); as lie) {
            <h3>Connecté avec {{ libelleFournisseur[lie.fournisseur] }}</h3>
            @if (lie.email) {
              <p class="adresse">{{ lie.email }}</p>
            }
            <p class="lien-donnees">Ta boîte et tes spots sont liés à ce compte.</p>
          } @else if (lectureFaite()) {
            <h3>Compte anonyme</h3>
            <p>Lie-le à Google, à Apple ou à ton e-mail pour garder ta boîte et tes spots si tu changes de téléphone.</p>
            <button type="button" class="fournisseur apple" [disabled]="enCours()" (click)="lier('apple')">Continuer avec Apple</button>
            <button type="button" class="fournisseur google" [disabled]="enCours()" (click)="lier('google')">Continuer avec Google</button>
            @if (formulaireEmail()) {
              <label class="champ">
                <span class="libelle">E-mail</span>
                <input
                  type="email"
                  autocomplete="email"
                  inputmode="email"
                  [class.en-erreur]="message() === 'email-invalide' || message() === 'adresse-utilisee'"
                  [value]="email()"
                  (input)="email.set($any($event.target).value)"
                />
              </label>
              <label class="champ">
                <span class="libelle">Mot de passe</span>
                <input
                  type="password"
                  autocomplete="new-password"
                  [class.en-erreur]="message() === 'mot-de-passe-court'"
                  [value]="motDePasse()"
                  (input)="motDePasse.set($any($event.target).value)"
                />
                <span class="aide">Au moins 6 caractères.</span>
              </label>
              <button type="button" class="fournisseur principal" [disabled]="enCours()" (click)="lierEmail()">Créer mon compte</button>
            } @else {
              <button type="button" class="fournisseur email" [disabled]="enCours()" (click)="ouvrirFormulaireEmail()">Continuer avec l’e-mail</button>
            }
            <div aria-live="polite">
              @if (enCours()) {
                <p class="en-cours">Connexion en cours…</p>
              }
              @if (message() === 'hors-ligne') {
                <p class="info" role="status">Connecte-toi à internet pour te connecter.</p>
              }
            </div>
            @switch (message()) {
              @case ('deja-associe') {
                <p class="erreur" role="alert">Ce compte est déjà associé à un autre profil Leurio.</p>
              }
              @case ('email-invalide') {
                <p class="erreur" role="alert">Adresse e-mail invalide.</p>
              }
              @case ('mot-de-passe-court') {
                <p class="erreur" role="alert">Le mot de passe doit contenir au moins 6 caractères.</p>
              }
              @case ('adresse-utilisee') {
                <p class="erreur" role="alert">Cette adresse est déjà utilisée.</p>
              }
              @case ('echec') {
                <p class="erreur" role="alert">La connexion n’a pas abouti. Réessaie.</p>
              }
            }
          }
        </div>
        }
        <h2 class="titre-groupe">Réglages</h2>
        <div class="groupe">
          <a class="rangee" [routerLink]="['/compte', 'preferences']">
            <span>
              Préférences
              <span class="sous">Espèces, niveau, unités</span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
          <a class="rangee" [routerLink]="['/compte', 'theme']">
            <span>Thème</span>
            <span class="valeur">{{ libelleTheme() }}</span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
          <a class="rangee" [routerLink]="['/compte', 'consentements']">
            <span>
              Consentements
              <span class="sous">Mesure d’audience, vidéos</span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </div>
        <h2 class="titre-groupe">Informations</h2>
        <div class="groupe">
          <a class="rangee" [routerLink]="['/compte', 'a-propos']">
            <span>À propos et sources</span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
          <a class="rangee" [routerLink]="['/compte', 'confidentialite']">
            <span>Confidentialité</span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </div>
        <h2 class="titre-groupe">Réglementation</h2>
        <div class="groupe">
          <a class="rangee" href="https://www.cartedepeche.fr" target="_blank" rel="noopener">
            <span>
              Carte de pêche
              <span class="sous">Achète ta carte sur le site officiel</span>
            </span>
            <span class="externe">cartedepeche.fr <span aria-hidden="true">↗</span></span>
          </a>
        </div>
      </ion-content>
    }
    <router-outlet (activate)="enfantOuvert.set(true)" (deactivate)="enfantOuvert.set(false)" />
  `,
})
export class ComptePage {
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  private readonly liaison = inject(SOURCE_LIAISON);

  protected readonly compteLie = signal<CompteLie | null>(null);
  /** Faux tant que le compte courant n'est pas lu : l'écran n'affiche alors aucun bouton (pas de flash pour un compte déjà lié). */
  protected readonly lectureFaite = signal(false);
  protected readonly enCours = signal(false);
  protected readonly message = signal<MessageLiaison | null>(null);
  protected readonly formulaireEmail = signal(false);
  protected readonly email = signal('');
  protected readonly motDePasse = signal('');
  protected readonly libelleFournisseur: Record<FournisseurLiaison, string> = { google: 'Google', apple: 'Apple', email: 'l’e-mail' };

  /**
   * Décision du propriétaire (US 95, réponse B) : la connexion se fait dans une fenêtre web ; la connexion native
   * (plugin Capacitor) n'existe pas encore, donc le groupe « Ton compte » est masqué dans les apps iOS et Android.
   */
  protected readonly natif = Capacitor.isNativePlatform();

  constructor() {
    if (this.natif) return;
    // Lecture seule : une erreur de lecture laisse l'écran à l'état anonyme.
    this.liaison
      .compteLie()
      .catch(() => null)
      .then((lie) => {
        this.compteLie.set(lie);
        this.lectureFaite.set(true);
      });
  }

  protected ouvrirFormulaireEmail(): void {
    this.message.set(null);
    this.formulaireEmail.set(true);
  }

  /** US 96 : la saisie est vérifiée sur l'appareil avant tout envoi ; le compte courant est lié, jamais remplacé. */
  protected async lierEmail(): Promise<void> {
    if (this.enCours()) return;
    this.message.set(null);
    const adresse = this.email().trim();
    if (!FORMAT_EMAIL.test(adresse)) {
      this.message.set('email-invalide');
      return;
    }
    if (this.motDePasse().length < MOT_DE_PASSE_MIN) {
      this.message.set('mot-de-passe-court');
      return;
    }
    if (navigator.onLine === false) {
      this.message.set('hors-ligne');
      return;
    }
    this.enCours.set(true);
    try {
      this.compteLie.set(await this.liaison.lierEmail(adresse, this.motDePasse()));
    } catch (erreur) {
      this.message.set(messagePourErreurEmail((erreur as { code?: string } | null)?.code));
    } finally {
      this.enCours.set(false);
    }
  }

  protected async lier(fournisseur: 'google' | 'apple'): Promise<void> {
    if (this.enCours()) return;
    this.message.set(null);
    if (navigator.onLine === false) {
      this.message.set('hors-ligne');
      return;
    }
    this.enCours.set(true);
    try {
      this.compteLie.set(await this.liaison.lier(fournisseur));
    } catch (erreur) {
      const code = (erreur as { code?: string } | null)?.code;
      if (code === 'auth/provider-already-linked') {
        // Le compte est déjà lié à ce fournisseur : on montre l'état lié au lieu d'une erreur.
        this.compteLie.set(await this.liaison.compteLie().catch(() => null));
      } else {
        this.message.set(messagePourErreur(code));
      }
    } finally {
      this.enCours.set(false);
    }
  }

  protected readonly libelleTheme = computed(() => CHOIX_THEME.find((c) => c.valeur === this.theme.choix())?.libelle);

  /**
   * Vrai quand une page enfant (Préférences, Thème, Consentements, À propos et sources, Confidentialité) est ouverte : l'écran « Compte » lui laisse la place.
   * Piloté par l'activation de la sortie, pour masquer l'en-tête dans le même passage que l'apparition de l'enfant.
   */
  protected readonly enfantOuvert = signal(this.router.url.split(/[?#]/)[0].startsWith('/compte/'));
}
