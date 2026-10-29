# Leurio

PWA Angular + Ionic + Capacitor qui conseille aux pêcheurs débutants et intermédiaires, en eau douce en France, quel leurre et quelle animation utiliser maintenant, ici. Backend Firebase.

**Le plan du projet est `docs/PLAN.md` : il fait foi.** Les règles qui en découlent sont dans `.claude/rules/plan.md` et s'appliquent à chaque user story.

## Commands

- Installation : `npm ci`
- Lint : `npm run lint`
- Type check : `npm run typecheck`
- Tests unitaires et de composants (Vitest) : `npm test`
- Tests d'acceptation : `npm run test:acceptance`
- Tests de bout en bout (Playwright) : `npm run test:e2e`
- Serveur de développement : `npm start`
- Build : `npm run build`
- Node 24 requis (`.nvmrc`).

## Conventions

- Architecture, arborescence et modèle de données : `docs/PLAN.md` §4, §5 et §7.
- Moteur (`core/engine`) et réglementation (`core/regulation`) en TypeScript pur, sans Angular.
- Contenu (espèces, leurres, animations) en JSON validés par JSON Schema, jamais en dur dans le code.
- Langue : code et identifiants comme dans le plan (`tempEau`, `tackleBox`…), interface en français.
- Plateforme : l'app vise d'abord iOS (iPhone, Safari puis Capacitor iOS) ; elle doit rester pleinement fonctionnelle sur Android. Les choix d'interface, de PWA et de natif se font d'abord pour iOS, puis on vérifie Android (demande du propriétaire, US 29).

## Workflow

- Work on a branch, never on `main`. One pull request per user story; a human merges it.
- Acceptance tests are written from the criteria of the user story before the implementation.
- Une user story qui modifie la vue commence par une maquette HTML, validée par le propriétaire avant tout test ou code (`.claude/rules/maquettes.md`).
- Toute user story cite les sections de `docs/PLAN.md` qu'elle met en œuvre ; une story qui contredit le plan est signalée au propriétaire, pas développée telle quelle.
