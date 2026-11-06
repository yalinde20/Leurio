# Changelog

## [1.21.0](https://github.com/yalinde20/Leurio/compare/v1.20.0...v1.21.0) (2026-11-06)


### Features

* **hubeau:** température de l'eau de la station la plus proche (US 53) ([be0f32d](https://github.com/yalinde20/Leurio/commit/be0f32d789f4d75b88fee9578c91d38976762f31))
* **hubeau:** une station reste active 7 jours au lieu de 48 h (US 53) ([3571c1a](https://github.com/yalinde20/Leurio/commit/3571c1a4d4a37c914b9b295c7de71094dded8240))


### Bug Fixes

* **hubeau:** rayon et classement sur la distance brute, mesures futures ignorées (US 53) ([f835edc](https://github.com/yalinde20/Leurio/commit/f835edc23797aa773be149dddf22e0f3c1d81366))

## [1.20.0](https://github.com/yalinde20/Leurio/compare/v1.19.0...v1.20.0) (2026-11-06)


### Features

* **position:** position GPS ou spot enregistré (US 59) ([217b51e](https://github.com/yalinde20/Leurio/commit/217b51ebcddbc51cc51f06b8598a2e6d5dd40cab))


### Bug Fixes

* **position:** la position approximative suffit (Android 12+) (US 59) ([5a5170d](https://github.com/yalinde20/Leurio/commit/5a5170da14405033984f7d1c23e9389e1bcdc1c0))
* **position:** refus natif et délai après la demande d'autorisation (US 59) ([31dee81](https://github.com/yalinde20/Leurio/commit/31dee81535fcb5b89717afef98153aa3809ef6c8))

## [1.19.0](https://github.com/yalinde20/Leurio/compare/v1.18.0...v1.19.0) (2026-11-06)


### Features

* département à partir des coordonnées, sans réseau (US 58) ([747070e](https://github.com/yalinde20/Leurio/commit/747070e66122980e5a4c4654717a44c3506fefe7))

## [1.18.0](https://github.com/yalinde20/Leurio/compare/v1.17.0...v1.18.0) (2026-11-05)


### Features

* moment de la journée (aube, jour, crépuscule, nuit) avec suncalc (US 57) ([3726acd](https://github.com/yalinde20/Leurio/commit/3726acdc3d6f2cf68bf46df09e4b8d1bcf098b2c))

## [1.17.0](https://github.com/yalinde20/Leurio/compare/v1.16.0...v1.17.0) (2026-11-05)


### Features

* moyenne de la température de l'air des derniers jours (US 52) ([e3893d9](https://github.com/yalinde20/Leurio/commit/e3893d97df7ba2e148ea37ab573a150ddd003186))


### Bug Fixes

* arrondi de la moyenne de l'air en dixièmes entiers (US 52) ([d63c330](https://github.com/yalinde20/Leurio/commit/d63c33081ab6199a255b0451db1d024c0399781d))

## [1.16.0](https://github.com/yalinde20/Leurio/compare/v1.15.0...v1.16.0) (2026-11-05)


### Features

* météo prévue à un moment choisi dans les 48 h via WeatherProvider ([e7389a8](https://github.com/yalinde20/Leurio/commit/e7389a813fb63e8627b74229a3bb8cd69eb644a5))


### Bug Fixes

* date invalide sans exception pour la météo prévue, heure demandée vérifiée dans la requête ([f8c1e6f](https://github.com/yalinde20/Leurio/commit/f8c1e6faee97422c02c72d8c6bd8c2eaa88e3392))

## [1.15.0](https://github.com/yalinde20/Leurio/compare/v1.14.0...v1.15.0) (2026-11-05)


### Features

* météo du moment d'un lieu via WeatherProvider (Open-Meteo) ([622c5b0](https://github.com/yalinde20/Leurio/commit/622c5b0794d1960cda2b1b6a6cf12ae316dd19a4))


### Bug Fixes

* délai max et unités explicites pour la météo, câblage toléré resserré ([bd6cd8c](https://github.com/yalinde20/Leurio/commit/bd6cd8ce619d8df4bb4c0309088ed23c2204016d))

## [1.14.0](https://github.com/yalinde20/Leurio/compare/v1.13.0...v1.14.0) (2026-11-05)


### Features

* poids initiaux du moteur dans engine-weights.json (US 46) ([b56e75f](https://github.com/yalinde20/Leurio/commit/b56e75fbfc94e97d6b17056e86312edb470bb8d6))

## [1.13.0](https://github.com/yalinde20/Leurio/compare/v1.12.0...v1.13.0) (2026-11-05)


### Features

* federations.json, la fédération de chaque département (US 45) ([6f43ba9](https://github.com/yalinde20/Leurio/commit/6f43ba98040454ea76aa58c648b1aa82f6d32a5c))


### Bug Fixes

* adresses des fédérations vérifiées en ligne (US 45) ([af1dc57](https://github.com/yalinde20/Leurio/commit/af1dc57f41517090e6b932274724546fd5f2016f))
* Cher vers l'annuaire FNPF, Lozère et Vienne confirmés (US 45) ([44bc482](https://github.com/yalinde20/Leurio/commit/44bc482355a0f8c8106ec538200a3c5fe2e4eddc))
* lien vers l'annuaire FNPF pour les fédérations sans adresse https (US 45) ([d6eb608](https://github.com/yalinde20/Leurio/commit/d6eb6087ccf791344d5371c71d3672c870ad6a79))
* revue de l'US 45 (articles des noms de fédération) ([83c103c](https://github.com/yalinde20/Leurio/commit/83c103ca08eed21f8e7f5b29a0af027d33eeca84))

## [1.12.0](https://github.com/yalinde20/Leurio/compare/v1.11.0...v1.12.0) (2026-11-04)


### Features

* interditFermetureBrochet selon la décision du propriétaire, petits leurres (US 43) ([58faa1c](https://github.com/yalinde20/Leurio/commit/58faa1c5596fc7eb99661e1a1c71c166d1cb8774))


### Bug Fixes

* revue de l'US 43 (sources reprises de techniques.json, frog en walking-the-dog) ([93d2922](https://github.com/yalinde20/Leurio/commit/93d2922efab698b6abb7b1878e01dd0e212bcd85))

## [1.11.0](https://github.com/yalinde20/Leurio/compare/v1.10.0...v1.11.0) (2026-11-04)


### Features

* techniques.json, les 8 animations et leurs vidéos (US 42) ([a93c320](https://github.com/yalinde20/Leurio/commit/a93c320ecdb7e29d44945a3dc46e2e013451f9e7))


### Bug Fixes

* revue de l'US 42 (vidéos non vérifiées sans dateVerif, sources qualifiées) ([52c4345](https://github.com/yalinde20/Leurio/commit/52c434528595e7ec5837674c9027a12931752936))

## [1.10.0](https://github.com/yalinde20/Leurio/compare/v1.9.0...v1.10.0) (2026-11-04)


### Features

* species.json, les 7 espèces du lancement (US 41) ([b9063b1](https://github.com/yalinde20/Leurio/commit/b9063b1b8669f43d747d5ee88b47a796b0637f73))


### Bug Fixes

* revue de l'US 41 (plages de température jointives, sources qualifiées) ([77a088b](https://github.com/yalinde20/Leurio/commit/77a088b3d7af47b80d3708b58a9be4b56fec36dd))

## [1.9.0](https://github.com/yalinde20/Leurio/compare/v1.8.0...v1.9.0) (2026-11-03)


### Features

* CatalogService, contenu embarqué servi à l'app (US 40) ([860a0dc](https://github.com/yalinde20/Leurio/commit/860a0dcdf24fa8f6923b36a8e693c94e50568785))


### Bug Fixes

* revue de l'US 40 (fédération indisponible sans erreur, réessai testé, contenu préchargé hors ligne testé) ([7742eff](https://github.com/yalinde20/Leurio/commit/7742eff8458ad009f06073ecb01692dcaaf5f449))

## [1.8.0](https://github.com/yalinde20/Leurio/compare/v1.7.0...v1.8.0) (2026-11-03)


### Features

* schémas JSON du contenu et validation par validate-data (US 38) ([3a54939](https://github.com/yalinde20/Leurio/commit/3a54939e2c8c8ce3409968b82336520574e5cf7f))


### Bug Fixes

* revue de l'US 38 (contenu provisoire honnête, fédérations vides, assertion du critère 1) ([bfd1a82](https://github.com/yalinde20/Leurio/commit/bfd1a820daab34ea6ca28a4313a0d1c8d12573eb))

## [1.7.0](https://github.com/yalinde20/Leurio/compare/v1.6.0...v1.7.0) (2026-11-03)


### Features

* déploiement de l'app sur Firebase Hosting depuis main (US 37) ([95ade08](https://github.com/yalinde20/Leurio/commit/95ade08bd56452167359c4aedbcd3a55ee7c131e))


### Bug Fixes

* revue de l'US 37 (tête de main, runs push, cache de la racine, durcissement) ([b07ab91](https://github.com/yalinde20/Leurio/commit/b07ab9115e0e70db1fd7eb684c8cd67a72f5c1fa))

## [1.6.0](https://github.com/yalinde20/Leurio/compare/v1.5.0...v1.6.0) (2026-10-31)


### Features

* initialisation de Firebase (Auth, Firestore hors ligne, Storage, App Check) sans secret commité (US 36) ([5638c54](https://github.com/yalinde20/Leurio/commit/5638c54bea7201d1dc6e58c05b393e8a1e11617e))


### Bug Fixes

* décisions du propriétaire pour l'US 36 (App Check local sans drapeau de débogage, test Capacitor sur build:emulateurs) ([9e5fd9a](https://github.com/yalinde20/Leurio/commit/9e5fd9a7918fd9b2cc48413fcebef1c90695dbea))
* revue de l'US 36 (démarrage non bloqué par Firebase, build Android en mode émulateurs, fichiers de config natifs ignorés) ([c6ba994](https://github.com/yalinde20/Leurio/commit/c6ba994a60f4e96a42b0de91b4847ac20ab59e78))

## [1.5.0](https://github.com/yalinde20/Leurio/compare/v1.4.0...v1.5.0) (2026-10-31)


### Features

* règles d'accès Storage pour les photos de leurres, testées sur l'émulateur (US 35) ([ef80676](https://github.com/yalinde20/Leurio/commit/ef806765cd0ac65d0ec38c734e9be632d2847daa))


### Bug Fixes

* revue de l'US 35 (commentaire de l'emplacement, sous-dossier refusé, tests CI resserrés) ([c10f604](https://github.com/yalinde20/Leurio/commit/c10f6043c32f5fd397cb93568ad2ed553d49c0bc))

## [1.4.0](https://github.com/yalinde20/Leurio/compare/v1.3.1...v1.4.0) (2026-10-30)


### Features

* barre d'onglets Conseil · Boîte · Spots · Compte (US 33) ([19209ee](https://github.com/yalinde20/Leurio/commit/19209ee85ab48c5259bdb63ac76c216a97f1b8ae))
* règles d'accès Firestore testées sur l'émulateur (US 34) ([d3b052f](https://github.com/yalinde20/Leurio/commit/d3b052ffc100b8bf3a6d4653848a6c88c894b15c))


### Bug Fixes

* revue de l'US 33 (barre dans shared/, graisse et icônes de la maquette, test prod des adresses d'onglet) ([b940a9d](https://github.com/yalinde20/Leurio/commit/b940a9d47227abe76dca7062899c927144d564c4))
* revue de l'US 34 (check obligatoire signalé, lanceur des tests de règles sans fichier) ([700e178](https://github.com/yalinde20/Leurio/commit/700e178f46bd617467a7aaf77932774f9a6dd60d))

## [1.3.1](https://github.com/yalinde20/Leurio/compare/v1.3.0...v1.3.1) (2026-10-30)


### Bug Fixes

* couleurs d'origine de la barre d'état quand index.html a déjà forcé le thème (US 32) ([eb5bab7](https://github.com/yalinde20/Leurio/commit/eb5bab7bc69d9978e400c63d4b4228aeafde67f0))

## [1.3.0](https://github.com/yalinde20/Leurio/compare/v1.2.0...v1.3.0) (2026-10-30)


### Features

* thèmes clair et sombre en tokens, suivant le réglage du téléphone (US 31) ([4f2bb97](https://github.com/yalinde20/Leurio/commit/4f2bb97ffd283f185cc463234d256604e2fc7503))


### Bug Fixes

* palette Ionic complète dans les deux thèmes, lint des CSS, imports Sass (US 31) ([ca5af7c](https://github.com/yalinde20/Leurio/commit/ca5af7c3e31e5a159c043af66416fa3cf8b0e3f1))

## [1.2.0](https://github.com/yalinde20/Leurio/compare/v1.1.0...v1.2.0) (2026-10-29)


### Features

* Capacitor avec les projets natifs Android et iOS (US 30) ([bdbddc2](https://github.com/yalinde20/Leurio/commit/bdbddc2bbaa284b71efb9ad88b98c04cedccf648))


### Bug Fixes

* package.json valide après la fusion de main (US 30) ([f202ce0](https://github.com/yalinde20/Leurio/commit/f202ce09e780f9a082191ae792c02ca9f878cf85))

## [1.1.0](https://github.com/yalinde20/Leurio/compare/v1.0.0...v1.1.0) (2026-10-29)


### Features

* app installable en PWA, iPhone d'abord (US 29) ([30fff44](https://github.com/yalinde20/Leurio/commit/30fff440d9a1b99cf704c194e36e4afb06f8f4ef))

## 1.0.0 (2026-10-29)


### Features

* socle Angular 22 + Ionic 9, arborescence du plan, lint, type check et tests (US 27) ([317c875](https://github.com/yalinde20/Leurio/commit/317c8757e8c5eaa52d511336e683cc91602c39cd))
