import { Component, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { SOURCE_COMPTE } from '../../core/data/compte.service';
import { BoutonRetourComponent } from '../../shared/bouton-retour/bouton-retour.component';

/** « Confidentialité » (US 91, PLAN §3) : le texte du propriétaire, embarqué donc lisible hors ligne, avec l'identifiant du compte en bas. */
@Component({
  selector: 'app-confidentialite',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BoutonRetourComponent],
  host: { class: 'ion-page' },
  styles: `
    .texte {
      font-size: 16px;
      line-height: 1.45;
      color: var(--lr-texte);
    }
    .maj {
      margin: 0 0 8px;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    h2 {
      margin: 18px 0 6px;
      font-size: 18px;
      font-weight: 700;
    }
    p,
    ul {
      margin: 0 0 10px;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin: 0 0 6px;
    }
    a {
      color: var(--lr-primaire);
    }
    .identifiant {
      padding: 12px 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-surface);
      font-family: monospace;
      overflow-wrap: anywhere;
      user-select: text;
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <app-bouton-retour slot="start" libelle="Compte" />
        <ion-title>Confidentialité</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="texte">
        <p class="maj">Mise à jour le 13 novembre 2026</p>

        <h2>Qui s’occupe de tes données</h2>
        <p>
          Leurio est éditée par Yoan Alindé, responsable de tes données. Pour toute question :
          <a href="mailto:yoyoalinde@gmail.com">yoyoalinde@gmail.com</a>.
        </p>

        <h2>Un compte sans nom ni e-mail</h2>
        <p>
          À la fin de l’accueil, Leurio te crée un compte anonyme : sans nom, sans e-mail, sans mot de passe. Il sert seulement à
          garder tes données à part de celles des autres.
        </p>

        <h2>Ce que Leurio garde en ligne</h2>
        <ul>
          <li>
            Ton niveau, tes espèces favorites, la date de création du compte et deux réglages internes (ton offre, gratuite, et tes
            consentements, tous sur « non »).
          </li>
          <li>
            Ta boîte à leurres : le type, la taille, le poids, la couleur, la marque si tu l’indiques, la date d’ajout, et la photo si
            tu en ajoutes une. Une photo de plus de 200 Ko est réduite avant l’envoi.
          </li>
        </ul>
        <p>
          Ces données sont chez Firebase, un service de Google. La base de données est dans l’Union européenne. Les règles d’accès
          empêchent les autres utilisateurs de les lire ou de les modifier. L’éditeur peut techniquement y accéder ; il ne le fait que
          pour répondre à ta demande ou régler un problème technique.
        </p>

        <h2>Ce qui reste sur ton téléphone</h2>
        <p>
          Tes réponses de l’accueil, ton choix de thème, la température que tu as mesurée au thermomètre, les dernières conditions
          météo obtenues et une copie de ta boîte, pour que l’app marche sans réseau. Ces données ne sont pas envoyées à Leurio. Elles
          sont nécessaires au fonctionnement de l’app : aucun consentement ne t’est donc demandé.
        </p>

        <h2>Ta position</h2>
        <p>
          Leurio te demande ta position pour le conseil, et seulement si tu l’autorises. Elle est envoyée telle quelle, sans être
          arrondie, à deux services publics de données :
        </p>
        <ul>
          <li>Open-Meteo, pour la météo ;</li>
          <li>Hub’Eau (Office français de la biodiversité et BRGM), pour la température et le débit des rivières proches.</li>
        </ul>
        <p>
          Leurio ne garde ta position ni en ligne ni sur ton téléphone ; seul le département est calculé, sur ton téléphone. Comme pour
          tout site web, ces services voient aussi l’adresse IP de ton téléphone. Open-Meteo indique garder les adresses IP et les
          requêtes pour surveiller l’usage de son service gratuit.
        </p>

        <h2>Les services qui aident Leurio</h2>
        <ul>
          <li>
            Google Firebase : ton compte, tes données, tes photos et l’hébergement de la version web. Google garde les adresses IP de
            connexion quelques semaines, et celles des visites du site web quelques mois.
          </li>
          <li>
            reCAPTCHA de Google, par Firebase App Check : il vérifie que les demandes viennent bien de l’app et pas d’un robot, à
            partir d’informations sur ton appareil et ton navigateur.
          </li>
        </ul>
        <p>
          Google agit pour le compte de l’éditeur. Certains de ses services, comme la connexion au compte, peuvent traiter des données
          hors de l’Union européenne, notamment aux États-Unis. Google est certifié au Data Privacy Framework UE–États-Unis, reconnu
          par la Commission européenne.
        </p>
        <p>Les liens vers cartedepeche.fr et les fédérations de pêche s’ouvrent dans ton navigateur : ces sites ont leurs propres règles.</p>

        <h2>Ce que Leurio ne fait pas</h2>
        <p>Pas de publicité, pas de revente de données, pas de mesure d’audience.</p>

        <h2>Pourquoi Leurio peut le faire</h2>
        <ul>
          <li>Ton compte, ta boîte et le conseil selon ta position : c’est le service que tu demandes (RGPD, article 6.1.b).</li>
          <li>La protection contre les abus : c’est l’intérêt légitime de l’éditeur à protéger l’app (article 6.1.f).</li>
        </ul>

        <h2>Combien de temps</h2>
        <p>
          Tes données sont gardées tant que ton compte existe, sans limite de durée : un compte inactif n’est pas supprimé
          automatiquement. Après une suppression, Google les efface de ses sauvegardes dans un délai de 180 jours au plus.
        </p>

        <h2>Attention : si tu supprimes l’app ou son raccourci</h2>
        <p>
          Ton compte anonyme n’existe que sur ce téléphone. Si tu supprimes l’app, Leurio ne peut plus te le rendre, et tes données
          restent en ligne jusqu’à leur suppression. Note ton identifiant de compte (en bas de cette page) avant de supprimer l’app.
        </p>

        <h2>Tes droits</h2>
        <p>
          Tu peux demander à accéder à tes données, à les corriger, à les supprimer ou à les récupérer, et t’opposer à leur utilisation
          ou la limiter. Écris à <a href="mailto:yoyoalinde@gmail.com">yoyoalinde@gmail.com</a> en indiquant ton identifiant de compte,
          affiché en bas de cette page. Si la réponse ne te convient pas, tu peux saisir la CNIL (<a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener"
            >cnil.fr</a
          >).
        </p>

        <h2>Ton identifiant de compte</h2>
        <p class="identifiant">{{ uid() ?? 'Pas encore de compte' }}</p>
      </div>
    </ion-content>
  `,
})
export class ConfidentialitePage {
  private readonly source = inject(SOURCE_COMPTE);

  /** L'identifiant du compte ; `null` pendant la lecture ou sans compte (ou si Firebase ne répond pas). */
  protected readonly uid = signal<string | null>(null);

  constructor() {
    this.source.uidCourant().then(
      (uid) => this.uid.set(uid),
      () => undefined,
    );
  }
}
