# Respect du plan Leurio

`docs/PLAN.md` est la référence du projet. Toute user story, tout test et tout code le respectent. Si une story contredit le plan, on le signale au propriétaire (`ask_user`), on ne tranche pas seul et on ne modifie pas le plan dans une PR de fonctionnalité.

## Architecture (§4, §5)

- Angular 20+ : composants standalone et signals, Ionic pour l'UI, Capacitor (Android et iOS) pour le natif. Pas de NgModule.
- Les fichiers vont à l'emplacement prévu par l'arborescence du §5 (`core/engine`, `core/regulation`, `core/data`, `core/firebase`, `features/<écran>`, `shared`, `src/assets/data`, `schemas`, `scripts`).
- `core/engine` et `core/regulation` sont du TypeScript pur : aucun import d'Angular, d'Ionic, de Capacitor ni de Firebase. Ils reçoivent des données et rendent des résultats.
- La météo passe toujours par l'interface `WeatherProvider` ; aucun code hors de son implémentation ne connaît Open-Meteo.
- Soleil, lune et heures légales sont calculés en local avec suncalc, jamais par une API.

## Contenu (§7, §9)

- Espèces, types de leurres, animations, kit de départ, fédérations et poids du moteur (`engine-weights.json`) vivent dans des JSON de contenu, validés par un JSON Schema dans `schemas/`.
- Aucune liste d'espèces, de leurres ou de règles propres à une espèce n'est écrite en dur dans le code : tout est lu depuis le contenu. Ajouter une espèce ne doit demander que des JSON.
- Chaque fiche de contenu porte `sources` et `dateVerif`.

## Données et vie privée (§4, §7)

- Firestore suit le modèle du §7 : `users/{uid}`, `users/{uid}/tackleBox`, `users/{uid}/spots`, `feedback`. `users/**` n'est lisible et modifiable que par son propriétaire ; `feedback` est en création seule, sans uid ni coordonnées exactes.
- Les spots sont privés par défaut.
- Analytics et lecteurs vidéo tiers ne se chargent qu'après consentement.
- Les photos sont compressées à ~200 Ko côté app avant envoi vers Storage.
- Aucune vidéo tierce n'est téléchargée ou réhébergée sans l'accord écrit de son auteur (§9 bis).

## Hors ligne et pannes (§4)

- Toute fonctionnalité dit ce qu'elle fait sans réseau. Le moteur tourne en local.
- Une source indisponible ne bloque jamais le conseil : on applique la dégradation du §4 et on l'affiche (source de la température, date des conditions en cache, conseil « moins précis »).

## Réglementation (§6)

- Toute information réglementaire affichée porte « à vérifier dans l'arrêté de ton département » et un lien vers la fédération.
- Hors des heures légales, l'app avertit au lieu de conseiller.

## Interface (§3)

- Cibles tactiles de 48 px minimum.
- Couleurs uniquement via des tokens définis pour le thème clair et le thème sombre (carte et graphiques compris). Pas de couleur en dur dans un composant.
- Textes de l'interface en français, tutoiement, phrases courtes.

## Tests (§11)

- Les services réseau (Hub'Eau, Open-Meteo, Firebase) sont testés avec des doubles ; aucun test n'appelle un service réel.
- Les cas de vérification du §11 qui concernent une story deviennent des tests de cette story.
