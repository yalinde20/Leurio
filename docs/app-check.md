# App Check

App Check prouve à Firebase que les requêtes viennent de la vraie app Leurio. Sans lui, n'importe quel script peut appeler Cloud Firestore, Cloud Storage et Authentication avec la clé publique du projet.

Cette page dit ce que fait l'app, ce que tu dois configurer dans la console Firebase, et comment passer à l'application forcée (enforcement).

## Ce que fait l'app

App Check est initialisé au démarrage, avant le premier accès à Firestore, à Storage ou à Authentication (`src/app/core/firebase/app-check.ts`).

| Plateforme | Fournisseur | Remarque |
| --- | --- | --- |
| Web (production) | reCAPTCHA Enterprise | Clé de site dans le secret `FIREBASE_APPCHECK_SITE_KEY`. |
| Android (production) | Play Integrity | Via le plugin `@capacitor-firebase/app-check`. |
| iOS (production) | App Attest | Via le même plugin. iOS 15 minimum, donc pas de repli DeviceCheck. |
| Développement, tests, émulateurs | Fournisseur local factice | Aucun jeton réel, aucun appel à Google. App Check n'est pas exigé. |

## Configuration dans la console Firebase

Console Firebase, projet Leurio, menu Build puis App Check, onglet Apps.

### Web : créer la clé reCAPTCHA Enterprise

Leurio utilise reCAPTCHA Enterprise pour l'app web.

1. Ouvre la console Google Cloud, page reCAPTCHA (https://console.cloud.google.com/security/recaptcha), sur le projet Google Cloud de Firebase (même identifiant que le projet Firebase). Si on te le demande, active l'API reCAPTCHA Enterprise.
2. Crée une clé reCAPTCHA Enterprise : bouton « Créer une clé », nom `Leurio web`, type « Site Web ».
3. Dans la liste des domaines de la clé, autorise :
   1. `<id-du-projet>.web.app`, le domaine de Firebase Hosting où l'app est déployée (remplace `<id-du-projet>` par l'identifiant du projet Firebase) ;
   2. `leurio.app`, une fois le domaine acheté et relié à Firebase Hosting. Ajoute-le alors à la même clé, sans en créer une nouvelle.

   Firebase Hosting sert aussi l'app sur `<id-du-projet>.firebaseapp.com`. Ce n'est pas l'adresse de l'app : ne la donne pas aux utilisateurs. Elle n'est pas dans la clé, donc l'app n'y fonctionne plus une fois l'application forcée activée.
4. N'active pas le défi par case à cocher (checkbox) : App Check a besoin d'une clé à score, sans défi visible.
5. Copie l'identifiant de la clé : c'est la clé de site.
6. Dans la console Firebase, App Check, onglet Apps : enregistre l'app web avec le fournisseur reCAPTCHA Enterprise et colle cette clé de site.
7. Mets la même clé de site dans le secret GitHub `FIREBASE_APPCHECK_SITE_KEY` (dépôt, Settings, Secrets and variables, Actions). Le workflow `deploy.yml` l'utilise pour le build de production : le déploiement suivant de `main` embarque la vraie clé.

Les tests, le développement et les émulateurs n'utilisent pas cette clé (fournisseur local factice) : pas besoin d'autoriser `localhost`.

Une fois la vraie clé en place et déployée, regarde les métriques puis active l'application forcée (sections suivantes).

### Android : Play Integrity

1. Enregistre l'app Android (`app.leurio`) avec le fournisseur Play Integrity.
2. Renseigne l'empreinte SHA-256 du certificat de la clé de signature de l'app. Tu la trouves dans la Play Console, menu Test et publication, Intégrité de l'application, Signature d'application.
3. Dans la Play Console, lie le projet Google Cloud de Firebase à l'API Play Integrity (Intégrité de l'application, Paramètres de l'API).

### iOS : App Attest

1. Enregistre l'app iOS (`app.leurio`) avec le fournisseur App Attest.
2. Renseigne le Team ID de ton compte Apple Developer.
3. La capacité App Attest est déjà dans `ios/App/App/App.entitlements` (environnement `production`). Vérifie qu'elle est activée pour l'identifiant de l'app dans ton compte Apple Developer.

## Fichiers de configuration natifs

`google-services.json` (Android) et `GoogleService-Info.plist` (iOS) ne sont pas dans Git. Ils doivent être présents dans les builds natifs de production. Sans eux, l'app n'obtient aucun jeton natif. Une fois l'application forcée activée, chaque appel à Firestore, à Storage et à Authentication est alors refusé.

## Avant d'appliquer : regarder les métriques

1. Publie une version de l'app avec App Check (web, Android, iOS).
2. Dans la console, ouvre App Check, section Cloud Firestore, Cloud Storage puis Authentication, et regarde les métriques.
3. Installe un build de production depuis TestFlight (iOS) et depuis la piste de test interne de Google Play (Android). Utilise l'app, puis vérifie que les métriques de la console montrent des requêtes vérifiées pour iOS et pour Android, pas seulement pour le web.
4. Attends que presque toutes les requêtes soient « vérifiées ». Les requêtes « non vérifiées » viennent d'anciennes versions de l'app, de scripts ou d'une erreur de configuration.

## Activer l'application forcée (enforcement)

Après la mise en place de la vraie clé et le contrôle des métriques, active l'application forcée App Check. Action du propriétaire, dans la console Firebase, menu Build puis App Check, onglet API :

1. Cloud Firestore : clique sur « Appliquer ».
2. Cloud Storage : clique sur « Appliquer ».
3. Authentication : clique sur « Appliquer ».

Une fois appliqué, toute requête sans jeton App Check valide est refusée (rejetée par le service). Cela vaut aussi pour les anciennes versions de l'app qui n'ont pas App Check : elles ne se connectent plus, ne lisent plus rien et n'écrivent plus rien. Prévois une mise à jour de l'app avant d'appliquer.

Si l'app cesse de fonctionner juste après, désactive l'application forcée dans la console : le retour est immédiat.

## Tests et jetons de débogage

L'app n'a pas de fournisseur de débogage (debug) pour les builds natifs. Un build natif, même de debug, utilise toujours Play Integrity ou App Attest. La variable `FIRAAppCheckDebugToken` est ignorée et aucun jeton de débogage n'apparaît dans logcat ou dans Xcode.

- Les tests automatiques et le développement utilisent les émulateurs et le fournisseur local factice. Ils n'ont besoin d'aucun jeton.
- Pour tester un build natif contre le vrai projet une fois l'application forcée activée, installe un build venu de Google Play (piste de test interne) ou de TestFlight. Ces builds passent l'attestation.
- Un build lancé depuis Android Studio ou Xcode sur un appareil peut échouer à l'attestation : ne compte pas sur lui contre le vrai projet.
