# Maquette avant tout changement de vue

Toute user story qui modifie une vue (un écran, un composant affiché, un texte, un style, un état visible) a une maquette HTML **validée par le propriétaire avant le début du développement** : ni test d'acceptation, ni code de production tant qu'elle n'est pas validée. En cas de doute sur le fait qu'une story modifie la vue, on fait la maquette.

## Écrire les user stories

Une story qui modifie la vue le dit dans ses notes : « Maquette HTML à valider avant le développement », avec les écrans et les états concernés.

## La maquette

- Un seul fichier HTML autonome : `docs/maquettes/us-<numéro de l'issue>-<slug>.html`, commité sur la branche de la story. Pas de framework, pas de script ni de feuille de style externe ; les polices peuvent venir de Google Fonts.
- Largeur d'un téléphone (390 px), avec un interrupteur pour voir le **thème clair et le thème sombre**, dessinés avec les tokens de couleur du projet (§3 du plan).
- **iPhone d'abord** : la maquette montre l'app sur iPhone (Safari ou app installée) ; Android n'apparaît que là où son affichage diffère.
- Chaque état utile à la story : normal, vide, chargement, erreur, hors ligne, et chaque cas des critères d'acceptation qui change l'affichage.
- Vrais textes de l'interface en français, cibles tactiles de 48 px, et rien d'autre que ce que demande la story.
- Elle est statique : elle montre, elle ne calcule rien.

## La validation

- La maquette est montrée au propriétaire par un lien qu'il peut ouvrir depuis son téléphone, puis la question est posée avec `ask_user` : valider, ou dire quoi changer.
- Tant qu'il demande des changements, on corrige la maquette et on repose la question.
- Une fois validée, elle est la référence de la story : les tests, le code et la revue s'y conforment. Un écart nécessaire pendant le développement est soumis au propriétaire avant d'être fait.
