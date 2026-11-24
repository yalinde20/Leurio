# App Check

App Check prouve à Firebase que les requêtes viennent de la vraie app Leurio. Sans lui, n'importe quel script peut appeler Cloud Firestore et Cloud Storage avec la clé publique du projet.

Cette page dit ce que fait l'app, ce que tu dois configurer dans la console Firebase, et comment passer à l'application stricte (enforcement).

## Ce que fait l'app

App Check est initialisé au démarrage, avant le premier accès à Firestore ou à Storage (`src/app/core/firebase/app-check.ts`).

| Plateforme | Fournisseur | Remarque |
| --- | --- | --- |
| Web (production) | reCAPTCHA Enterprise | Clé de site dans le secret `FIREBASE_APPCHECK_SITE_KEY`. |
| Android (production) | Play Integrity | Via le plugin `@capacitor-firebase/app-check`. |
| iOS (production) | App Attest | Via le même plugin. iOS 15 minimum, donc pas de repli DeviceCheck. |
| Développement, tests, émulateurs | Fournisseur local factice | Aucun jeton réel, aucun appel à Google. App Check n'est pas exigé. |

## Configuration dans la console Firebase

Console Firebase, projet Leurio, menu Build puis App Check, onglet Apps.

### Web : reCAPTCHA Enterprise

1. Dans Google Cloud, crée une clé reCAPTCHA Enterprise de type site web, avec le domaine où l'app est hébergée.
2. Dans la console Firebase, enregistre l'app web avec le fournisseur reCAPTCHA Enterprise et colle cette clé.
3. Mets la même clé de site dans le secret GitHub `FIREBASE_APPCHECK_SITE_KEY`. Le workflow `deploy.yml` l'utilise déjà pour le build de production.

### Android : Play Integrity

1. Enregistre l'app Android (`app.leurio`) avec le fournisseur Play Integrity.
2. Renseigne l'empreinte SHA-256 du certificat de la clé de signature de l'app. Tu la trouves dans la Play Console, menu Test et publication, Intégrité de l'application, Signature d'application.
3. Dans la Play Console, lie le projet Google Cloud de Firebase à l'API Play Integrity (Intégrité de l'application, Paramètres de l'API).

### iOS : App Attest

1. Enregistre l'app iOS (`app.leurio`) avec le fournisseur App Attest.
2. Renseigne le Team ID de ton compte Apple Developer.
3. La capacité App Attest est déjà dans `ios/App/App/App.entitlements` (environnement `production`). Vérifie qu'elle est activée pour l'identifiant de l'app dans ton compte Apple Developer.

## Fichiers de configuration natifs

`google-services.json` (Android) et `GoogleService-Info.plist` (iOS) ne sont pas dans Git. Ils doivent être présents dans les builds natifs de production. Sans eux, l'app n'obtient aucun jeton natif. Une fois l'application stricte activée, chaque appel à Firestore et à Storage est alors refusé.

## Avant d'appliquer : regarder les métriques

1. Publie une version de l'app avec App Check (web, Android, iOS).
2. Dans la console, ouvre App Check, section Cloud Firestore puis Cloud Storage, et regarde les métriques.
3. Installe un build de production depuis TestFlight (iOS) et depuis la piste de test interne de Google Play (Android). Utilise l'app, puis vérifie que les métriques de la console montrent des requêtes vérifiées pour iOS et pour Android, pas seulement pour le web.
4. Attends que presque toutes les requêtes soient « vérifiées ». Les requêtes « non vérifiées » viennent d'anciennes versions de l'app, de scripts ou d'une erreur de configuration.

## Appliquer l'App Check (enforcement)

Action du propriétaire, dans la console Firebase :

1. App Check, onglet API, puis Cloud Firestore : clique sur « Appliquer ».
2. Fais la même chose pour Cloud Storage.

Une fois appliqué, toute requête sans jeton App Check valide est refusée (rejetée par le service). Cela vaut aussi pour les anciennes versions de l'app qui n'ont pas App Check : elles ne lisent plus rien et n'écrivent plus rien. Prévois une mise à jour de l'app avant d'appliquer.

Si l'app cesse de fonctionner juste après, désactive l'application dans la console : le retour est immédiat.

## Tests et jetons de débogage

L'app n'a pas de fournisseur de débogage (debug) pour les builds natifs. Un build natif, même de debug, utilise toujours Play Integrity ou App Attest. La variable `FIRAAppCheckDebugToken` est ignorée et aucun jeton de débogage n'apparaît dans logcat ou dans Xcode.

- Les tests automatiques et le développement utilisent les émulateurs et le fournisseur local factice. Ils n'ont besoin d'aucun jeton.
- Pour tester un build natif contre le vrai projet une fois l'application stricte activée, installe un build venu de Google Play (piste de test interne) ou de TestFlight. Ces builds passent l'attestation.
- Un build lancé depuis Android Studio ou Xcode sur un appareil peut échouer à l'attestation : ne compte pas sur lui contre le vrai projet.
