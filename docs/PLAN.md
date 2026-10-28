# Plan de l'app Leurio

> Document de référence du projet. Toute user story, tout ticket et tout code doivent le respecter.
> Une évolution du plan se fait par une modification de ce fichier, validée par le propriétaire du dépôt, jamais implicitement dans une PR de fonctionnalité.

## Contexte

Leurio répond à la question « **quel leurre, quelle animation, maintenant, ici ?** ». L'app vise les pêcheurs débutants et intermédiaires, en eau douce et en France. La recherche préalable (`Sources de données pour l'app de pêche aux leurres`) a déjà identifié les données : Hub'Eau, Open-Meteo, suncalc et une base de leurres maison. Ce plan fixe le périmètre du MVP, les écrans, l'architecture, la réglementation, les coûts et l'ordre de construction.

**Choix :**
- **Nom** : **Leurio** (validé)
- **Plateforme** : PWA Angular et Capacitor (web d'abord, stores ensuite)
- **Milieu** : eau douce
- **Public** : débutants et intermédiaires
- **MVP** : moteur de conseil, fiche animation simple (le geste et une vidéo), boîte à leurres, spots privés
- **Backend** : Firebase (Auth et Firestore)
- **Modèle** : projet perso pour l'instant, mais pensé dès le départ pour devenir une vraie app publique sur les stores Android et iOS (voir §4, « Prêt pour une app publique »)
- **Espèces** : brochet, sandre, perche, black-bass, chevesne, aspe, silure au lancement. D'autres s'ajouteront plus tard, par simple ajout dans les fichiers de contenu, sans changer le code (voir §7)
- **Conseil** : basé en priorité sur les leurres de la boîte de l'utilisateur
- **Localisation** : GPS ou spot enregistré
- **Hors ligne** : essentiel

---

## 1. Nom : Leurio

À vérifier avant de communiquer dessus :
- le nom est libre sur l'App Store et le Play Store ;
- la marque est libre à l'INPI (classes 9 et 28), puis à déposer (~190 € pour 1 classe) ;
- le domaine `leurio.app` ou `leurio.fr` est disponible ;
- le compte Instagram ou TikTok `@leurio` est libre.

**Identité visuelle** :
- logo : un leurre stylisé ou un « L » en forme d'hameçon ;
- palette eau et nature (vert eau, sable) avec une couleur d'accent vive, façon fire-tiger, pour les actions ;
- icône d'app et écran de démarrage.

---

## 2. Périmètre MVP (V1)

1. **Conseil du moment** (écran d'accueil)
   - Position GPS ou spot enregistré, maintenant ou à une date et une heure choisies (« demain 7 h », dans les 48 h à venir).
   - Choix de l'espèce : toutes, ou une espèce cible.
   - L'app récupère les conditions : température de l'eau, débit, pression, nuages, vent, soleil et lune.
   - Elle produit un top 3 « type de leurre + animation + couleur + taille ou poids », avec un **pourquoi** en clair.
   - Pour chaque conseil : « Dans ta boîte : Shad 10 cm gardon », ou « Il te manque : un shad 7–10 cm couleur naturelle ».
   - Bandeau réglementation (voir §6).
   - Bouton « J'ai mesuré l'eau » pour saisir la température au thermomètre ; le conseil est alors recalculé.
   - Retour en un geste : « Ce conseil t'a aidé ? 👍 / 👎 », pour ajuster les règles.
2. **Fiche animation** : le geste en 2 ou 3 phrases, la vitesse, l'erreur à éviter, et une vidéo qui se lit **dans l'application**, calée au bon moment (voir §9 bis).
3. **Boîte à leurres** : ajouter un leurre (type, taille, poids, couleur, photo facultative, marque libre). Un « kit de départ conseillé » montre au débutant les 5 leurres à acheter en premier.
4. **Spots** : une carte, des spots privés par défaut, avec le nom, la catégorie (1re ou 2e), le type d'eau (rivière, lac, canal) et le département (détecté depuis les coordonnées). Un lien vers la fédération du département aide à trouver la catégorie.
5. **Compte** : connexion Google ou e-mail, ou mode anonyme converti plus tard en compte. Suppression du compte et export des données depuis l'app.

**Hors MVP, dans l'ordre conseillé** :
1. carnet de prises avec conditions enregistrées automatiquement ;
2. bibliothèque complète des leurres et animations ;
3. Hub'Eau Poisson (espèces présentes près de toi) ;
4. notifications du type « conditions top sur ton spot demain » ;
5. statistiques par leurre ;
6. truite, puis mer.

---

## 3. Écrans et navigation

**Barre d'onglets (4)** : Conseil · Boîte · Spots · Compte. La fiche animation s'ouvre depuis un conseil.

| Écran | Contenu |
|---|---|
| **Onboarding** (3 pages, au 1er lancement) | 1. Ce que fait Leurio. 2. Tes espèces préférées et ton niveau. 3. Autorisation GPS expliquée, puis compte anonyme créé en silence. |
| **Conseil** | Sélecteur lieu et moment ; carte « conditions » (température de l'eau et sa source, tendance du débit, pression, ciel, vent, lune, heures légales) ; 3 cartes de conseil ; bandeau réglementation ; boutons thermomètre et « Préparer ma sortie » |
| **Détail d'un conseil** | Le pourquoi complet (chaque règle déclenchée), la couleur, la taille, le poids de tête, le poste où le lancer, le lien vers la fiche animation, le leurre de ta boîte ou « Il te manque » |
| **Fiche animation** | Geste, vitesse, erreur à éviter, vidéo lue dans l'app (boucle courte hors ligne, vidéo complète en ligne) |
| **Boîte** | Liste filtrable par famille ; formulaire d'ajout ; kit de départ |
| **Spots** | Carte Leaflet ; liste ; formulaire ; « Préparer ma sortie » sur un spot |
| **Compte** | Connexion, préférences (espèces, unités), À propos et sources, confidentialité, export, suppression du compte |

**Ergonomie au bord de l'eau** :
- gros boutons (48 px minimum), utilisables avec des mains mouillées ou des gants ;
- **deux thèmes complets : mode clair et mode sombre.** Le mode clair, très contrasté, sert en plein soleil ; le mode sombre sert à l'aube, au crépuscule et la nuit, sans éblouir. Par défaut, l'app suit le réglage du téléphone ; un interrupteur dans Compte permet de forcer clair ou sombre. Toutes les couleurs sont définies en variables (tokens) pour les deux thèmes, y compris la carte et les graphiques ;
- le conseil s'affiche dès l'ouverture, en 2 taps au maximum.

---

## 4. Architecture technique

```
┌──────────── App Angular (PWA + Capacitor) ─────────────┐
│ UI (standalone components + signals, Ionic)            │
│ ├─ features/ onboarding · conseil · animation · boite · spots · compte │
│ ├─ core/engine      ← moteur de règles (pur TS, testable) │
│ ├─ core/regulation  ← calendrier, tailles, heures légales │
│ ├─ core/data        ← services API + cache              │
│ └─ assets/data      ← base leurres/animations/espèces JSON │
└──────┬───────────────────┬──────────────────┬──────────┘
  Hub'Eau (temp,      Open-Meteo        Firebase
  hydrométrie)        (forecast,        Auth + Firestore + Storage
                      archive)          + Crashlytics/Analytics
       └─ suncalc (local, sans réseau)
```

**Stack :**
- **Angular 20+** : composants standalone, signals, `@angular/pwa` (service worker)
- **Ionic** : composants UI conçus pour Capacitor
- **Capacitor** : Geolocation, Camera, Preferences, puis Push en V2
- **Firebase** :
  - Auth ;
  - Firestore avec `persistentLocalCache` (le hors ligne et la synchronisation se font automatiquement) ;
  - Storage pour les photos de leurres, compressées à ~200 Ko côté app ;
  - App Check, contre les abus ;
  - Crashlytics, pour les plantages ;
  - Analytics, seulement si l'utilisateur l'accepte.
- **Carte** : Leaflet avec OpenStreetMap, et des tuiles en cache autour des spots
- **suncalc** : soleil, lune et heures légales calculés en local

**Hors ligne :**
- La base JSON de leurres et d'animations est embarquée dans le bundle.
- « Préparer ma sortie » télécharge les conditions sur 48 h et les met en cache (IndexedDB). Le moteur tourne ensuite en local.
- La boîte et les spots passent par le cache Firestore et se synchronisent au retour du réseau.
- Les boucles vidéo courtes (voir §9 bis) sont embarquées ou téléchargées à l'avance : elles marchent sans réseau. Les vidéos complètes de YouTube et des autres plateformes demandent du réseau.

**Prêt pour une app publique** : ces choix évitent de tout refaire le jour où Leurio sort sur les stores.
- **Capacitor** : Android et iOS sont prévus dès la phase 0, pas ajoutés à la fin.
- **Météo** : l'accès passe par une interface `WeatherProvider`. Aujourd'hui, Open-Meteo gratuit ; demain, l'offre commerciale d'Open-Meteo ou l'API Météo-France, sans toucher au moteur. Le changement est nécessaire dès que l'app rapporte de l'argent (offre gratuite non commerciale).
- **Contenu** : séparé du code (JSON validés), il peut grandir sans nouvelle version de l'app, et passer plus tard dans Firestore ou un petit back-office.
- **Comptes** : connexion Apple ajoutée dès qu'il y a la connexion Google (Apple l'exige sur iOS).
- **Données utilisateur** : suppression et export du compte dès le MVP, exigés par les deux stores.
- **Monétisation future** (Pro, affiliation) : un champ `plan` sur l'utilisateur et des fonctionnalités activables (feature flags via Firebase Remote Config), sans les construire maintenant.

**Si une API est en panne** :
- Hub'Eau ne répond pas : l'app estime la température de l'eau depuis l'air.
- Open-Meteo ne répond pas : l'app reprend les dernières conditions en cache, avec la mention « conditions du 27/10 à 18 h ».
- Rien n'est disponible : conseil basé sur la saison et la température saisie, signalé comme moins précis.

---

## 5. Structure du projet

```
leurio/
├─ src/app/
│  ├─ core/
│  │  ├─ engine/            # moteur de recommandation (aucune dépendance Angular)
│  │  │  ├─ conditions.ts   # type Conditions
│  │  │  ├─ rules/          # temperature, saison, couleur, poids, luminosite…
│  │  │  ├─ scorer.ts       # score + explications
│  │  │  └─ matcher.ts      # type recommandé → leurres de la boîte
│  │  ├─ regulation/
│  │  │  ├─ calendar.ts     # fermetures brochet/sandre/black-bass de l'année
│  │  │  ├─ sizes.ts        # tailles minimales, quotas
│  │  │  └─ legal-hours.ts  # 30 min avant lever / après coucher (suncalc)
│  │  ├─ data/
│  │  │  ├─ hubeau.service.ts
│  │  │  ├─ open-meteo.service.ts
│  │  │  ├─ astro.service.ts
│  │  │  ├─ conditions.service.ts    # agrège + cache + pannes
│  │  │  ├─ geo.service.ts           # coordonnées → département
│  │  │  └─ catalog.service.ts       # charge assets/data/*.json
│  │  └─ firebase/          # auth, repositories Firestore
│  ├─ features/
│  │  ├─ onboarding/ · conseil/ · animation/ · boite/ · spots/ · compte/
│  └─ shared/               # composants UI communs
├─ src/assets/data/
│  ├─ lure-types.json       # ~20 types
│  ├─ techniques.json       # ~8 animations
│  ├─ species.json          # 7 espèces
│  ├─ starter-kit.json      # kit de départ
│  └─ federations.json      # département → URL fédération
├─ schemas/                 # JSON Schema des fichiers de contenu
├─ scripts/
│  ├─ validate-data.ts      # vérifie les JSON (CI)
│  └─ check-videos.ts       # vérifie que les vidéos existent encore
├─ capacitor.config.ts
└─ firebase.json / firestore.rules / storage.rules
```

---

## 6. Réglementation (eau douce, règles nationales)

Le module `core/regulation` calcule tout pour l'année en cours. Chaque affichage porte la mention « à vérifier dans l'arrêté de ton département » et un lien vers la fédération.

| Règle | Contenu | Usage dans l'app |
|---|---|---|
| Ouverture 1re catégorie | Du 2e samedi de mars au 3e dimanche de septembre | Bandeau « fermé » sur un spot de 1re catégorie hors saison |
| Fermeture brochet en 2e catégorie | Du dernier lundi de janvier au vendredi avant le dernier samedi d'avril | Leurres `interditFermetureBrochet` exclus du conseil, avec l'explication |
| Sandre | Souvent fermé en même temps que le brochet (arrêtés départementaux) | Avertissement « probablement fermé, vérifie » |
| Black-bass | Fermeture spécifique dans certains départements (période de fraie) | Avertissement « vérifie ton département » au printemps |
| Tailles minimales en 2e catégorie | Brochet 60 cm, sandre 50 cm, black-bass 40 cm (articles R436-18 et suivants, à vérifier) | Affichées sur chaque conseil pour l'espèce visée |
| Quota en 2e catégorie | 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum | Rappel dans le bandeau |
| Heures légales | De 30 min avant le lever à 30 min après le coucher du soleil ; pas de pêche aux carnassiers la nuit | Calculées avec suncalc et affichées dans les conditions |
| Carte de pêche | Obligatoire | Lien vers cartedepeche.fr dans l'onboarding et le Compte |

---

## 7. Modèle de données

**Embarqué (JSON, versionné)** : les schémas `lureTypes` et `techniques` de la recherche, plus `species` :

```json
{ "code": "SAN", "nom": "Sandre", "tempEauC": { "active": [12, 24], "ralentie": [6, 12], "quasiNulle": [0, 5] },
  "postes": ["cassures", "fond", "piles de pont"], "proies": ["gardon", "ablette"],
  "tailleMinCm": 50, "fermetureAvecBrochet": true }
```

**Ajouter une espèce plus tard** (truite, carpe au leurre, bar en mer…) : on crée sa fiche dans `species.json`, on ajoute son code dans les `especes` des types de leurres concernés, et c'est tout. Le moteur, les écrans et le filtre réglementaire lisent la liste des espèces depuis le contenu, jamais en dur dans le code. Les règles propres à une espèce (fermeture, taille minimale) sont des champs de sa fiche.

Codes Hub'Eau, à vérifier dans le référentiel Sandre :

| Espèce | Brochet | Sandre | Perche | Black-bass | Chevesne | Aspe | Silure |
|---|---|---|---|---|---|---|---|
| Code | BRO | SAN | PER | BBG | CHE | ASP | SIL |

**Firestore :**
```
users/{uid}                     { niveau, especesFavorites[], consentements{analytics, video}, createdAt }
users/{uid}/tackleBox/{lureId}  { typeId, tailleCm, poidsG, couleur, marque?, photoUrl?, createdAt }
users/{uid}/spots/{spotId}      { nom, lat, lng, categorie: 1|2, milieu, departement, prive: true }
feedback/{id}                   { conseilId, typeId, techniqueId, utile: bool, conditions (arrondies), date }
```

Règles d'accès :
- `users/**` : lecture et écriture seulement si `request.auth.uid == uid` ;
- `feedback` : création seulement, sans uid ni coordonnées exactes.

---

## 8. Moteur de recommandation

Il est écrit en TypeScript pur, sans dépendance Angular, et testé unitairement.

1. **Entrées** : un objet `Conditions` avec :
   - `tempEau` et `sourceTempEau` (capteur, estimation ou saisie) ;
   - `debitTendance` (crue, normal ou étiage), qui sert d'indice de clarté ;
   - `pressionTendance48h` ;
   - `nuages`, `vent` et `moment` (aube, jour, crépuscule, nuit) ;
   - `saison`, `categorie`, `departement` ;
   - `especeCible` (facultative) ;
   - `niveau` de l'utilisateur.
2. **Température de l'eau, par ordre de priorité** :
   1. température saisie au thermomètre (moins de 6 h) ;
   2. station Hub'Eau active à moins de 30 km ;
   3. estimation depuis la moyenne de l'air sur 5 à 7 jours.

   La source est toujours affichée.
3. **Score** : pour chaque couple (type de leurre, animation) compatible avec l'espèce, on additionne des points pondérés. Chaque règle déclenchée produit une phrase d'explication.

   | Facteur | Poids |
   |---|---|
   | Température | fort |
   | Saison | moyen |
   | Clarté de l'eau, qui oriente la couleur | moyen |
   | Luminosité | faible |
   | Pression | faible, présentée comme un indice |
   | Lune | bonus seulement |
   | Difficulté de l'animation | pénalité si elle dépasse le niveau de l'utilisateur |
4. **Filtre réglementaire** : les leurres interdits pendant une fermeture sont exclus, avec l'explication. Hors des heures légales, l'app avertit au lieu de conseiller.
5. **Matcher** : pour chacun des 3 meilleurs types, on cherche dans la boîte le leurre de même type dont la taille et le poids sont les plus proches. Si la boîte n'en contient pas, le moteur cherche un leurre de substitution de la même zone de nage, puis affiche « Il te manque ».
6. **Poids des règles** : ils sont stockés dans un fichier de configuration (`engine-weights.json`), pour pouvoir les ajuster d'après les 👍 / 👎 sans toucher au code.

---

## 9. Gestion du contenu

- Les JSON sont validés par un JSON Schema à chaque commit (CI) : un fichier mal formé bloque le déploiement.
- Chaque fiche porte ses `sources` et sa `dateVerif`.
- Le script `check-videos.ts` tourne chaque semaine en GitHub Actions et ouvre une issue si une vidéo a disparu (YouTube Data API `videos.list`, oEmbed pour Vimeo et Dailymotion).

---

## 9 bis. Vidéos : les trouver et les rendre disponibles dans l'app

**Où chercher** :
- YouTube : chaînes des fabricants (Savage Gear, Fox Rage, Westin, Gunki, Sakura, Illex…), des magasins et des guides de pêche, avec une vue sous l'eau de préférence ;
- Vimeo et Dailymotion : même démarche, moins de contenu mais souvent de meilleure qualité ;
- sites des fabricants, qui ont souvent des vidéos de nage par modèle ;
- Instagram, TikTok et Facebook pour repérer des créateurs (pas d'intégration directe : on les contacte, voir plus bas).

Pour chaque animation : 1 à 3 vidéos, avec le moment exact de la démo noté.

**Comment la vidéo est disponible dans l'app**, trois niveaux :

| Source | Comment elle s'affiche | Hors ligne | Ce qu'il faut |
|---|---|---|---|
| Vidéo YouTube, Vimeo ou Dailymotion | Lecteur officiel intégré dans la fiche (iframe), démarre au bon moment | Non | Rien : l'intégration est autorisée par les plateformes |
| Vidéo d'un créateur ou d'une marque **avec son accord écrit** | Fichier hébergé par Leurio (Firebase Storage), lu par le lecteur de l'app | Oui, téléchargeable | Demander l'autorisation (e-mail type à préparer), créditer l'auteur avec un lien vers sa chaîne |
| **Propres vidéos** (bassin, eau claire, aquarium) | Boucle de 3 à 5 s embarquée dans l'app (MP4 léger ou WebM) | Oui, toujours | Filmer chaque animation ; c'est l'option la plus fiable à terme |

Règle importante : on ne télécharge pas et on ne réhéberge pas une vidéo YouTube ou autre **sans l'accord de son auteur**. C'est interdit par les conditions des plateformes et par le droit d'auteur, et c'est un motif de refus sur les stores.

**Stratégie conseillée** :
- **MVP** : lecteur intégré YouTube, Vimeo ou Dailymotion pour la démo complète, et une boucle courte filmée soi-même pour chaque animation, disponible hors ligne.
- **Ensuite** : contacter les créateurs et les marques pour héberger leurs meilleures démos, avec crédit (beaucoup acceptent en échange de visibilité).

**Format dans `techniques.json`** :

```json
"videos": [
  { "provider": "youtube", "id": "XXXXXXXXXXX", "start": 95, "auteur": "…", "lienAuteur": "…", "dateVerif": "2026-10-28" },
  { "provider": "vimeo", "id": "123456789", "start": 12, "auteur": "…" },
  { "provider": "self", "fichier": "videos/tiree-relachee.mp4", "boucle": true, "horsLigne": true, "licence": "propre" }
]
```

Un composant `VideoPlayer` unique choisit le bon lecteur selon `provider`, affiche la boucle hors ligne en l'absence de réseau, et demande le consentement avant de charger un lecteur tiers.

---

## 10. Feuille de route

| Phase | Contenu | Livrable |
|---|---|---|
| **0. Fondations** (1 sem.) | Vérifier et réserver le nom (stores, INPI, domaine) ; créer le projet Angular, Ionic et Capacitor (cibles Android et iOS dès le départ) ; thèmes clair et sombre ; configurer Firebase et la PWA ; mettre en place le CI (lint, tests, validation JSON, déploiement sur Firebase Hosting) | App vide déployée sur leurio.app |
| **0 bis. Design** (1 sem.) | Logo, palette, maquettes des 7 écrans (Figma), parcours d'onboarding | Maquettes validées |
| **1. Contenu + vidéos** (2–3 sem.) | 8 animations, ~20 types de leurres, 7 espèces, kit de départ, table des fédérations ; 1 à 3 vidéos trouvées par animation (YouTube, Vimeo, Dailymotion, fabricants) ; tournage des 8 boucles courtes ; e-mail type de demande d'autorisation aux créateurs | `assets/data/*.json` validés + boucles vidéo |
| **2. Conditions** (1–2 sem.) | Hub'Eau, Open-Meteo, suncalc, département ; agrégation avec cache et gestion des pannes | Écran « conditions » |
| **3. Moteur + réglementation** (2 sem.) | Règles, score, explications, calendrier, tailles, heures légales, tests unitaires | Top 3 avec explications |
| **4. Boîte + spots + compte** (2 sem.) | Onboarding, Auth, CRUD boîte et spots, carte, matcher, suppression et export du compte | MVP fonctionnel en ligne |
| **5. Hors ligne + qualité** (1 sem.) | Persistance Firestore, « Préparer ma sortie », cache des tuiles et du service worker, Crashlytics, App Check | MVP hors ligne |
| **6. Bêta** (2–3 sem.) | 10 à 20 pêcheurs testeurs, 👍 / 👎, ajustement des poids ; Android en test interne sur le Play Store, iOS sur TestFlight | Bêta Android + iOS |
| **7. Lancement** | Fiches des stores (captures, description), politique de confidentialité en ligne, page d'accueil leurio.app, annonce sur les forums et groupes de pêche | Leurio publié |

Durée totale estimée : 12 à 15 semaines à temps partiel.

---

## 11. Vérification

- **Moteur** : jeux de `Conditions` types avec le top 3 attendu. Exemples : « hiver, eau à 6 °C, sandre » doit donner verticale ou tirée-relâchée lente ; « été, aube, black-bass » doit donner un leurre de surface ; « débutant » ne doit pas recevoir d'animation de difficulté 3 en premier.
- **Réglementation** : dates de fermeture du brochet pour 2024 à 2027, comparées aux arrêtés connus (Maine-et-Loire, Seine-Maritime) ; heures légales comparées à un éphéméride.
- **Services** : réponses Hub'Eau et Open-Meteo simulées, y compris les pannes et l'absence de station proche.
- **Contenu** : `validate-data.ts` passe dans le CI.
- **Hors ligne** : préparer une sortie, passer en mode avion, vérifier que le conseil, la boîte et les spots restent accessibles, et qu'un spot ajouté se synchronise au retour du réseau.
- **Vidéos** : chaque `provider` (youtube, vimeo, self) se lit dans la fiche ; en mode avion, la boucle courte s'affiche à la place.
- **Thèmes** : chaque écran est vérifié en mode clair et en mode sombre, et suit le changement de réglage du téléphone.
- **Ajout d'espèce** : ajouter une 8e espèce de test dans les JSON doit la faire apparaître dans l'app et le moteur sans modifier le code.
- **PWA** : Lighthouse doit indiquer une app installable avec service worker actif.
- **Terrain** : comparer les conseils à l'avis de 2 ou 3 pêcheurs expérimentés pendant la bêta.
