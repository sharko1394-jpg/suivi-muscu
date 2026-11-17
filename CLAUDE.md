# Suivi Muscu : consignes de travail

Appli web personnelle (PWA) de suivi de musculation. Un seul utilisateur, non développeur,
sur iPhone. Le cahier des charges complet est dans `docs/cahier-des-charges.md` : il fait foi.

## Règles à ne jamais enfreindre

- Ne jamais renommer, vider ni recréer la base (`DB_NAME` dans `src/data/schema.ts`), ni changer
  la signature des sauvegardes (`BACKUP_APP_ID` dans `src/data/backup.ts`).
- Tout changement de forme de données déjà enregistrées = une nouvelle entrée à la fin de
  `SCHEMA_VERSIONS`, avec sa fonction `migrate` et son test. Ne jamais modifier une version déjà
  mise en ligne. La même migration sert à la base du téléphone et à l'import d'anciennes
  sauvegardes.
- Ne jamais modifier ni réutiliser l'identifiant d'un exercice fourni
  (`src/data/builtinExercises.ts`). En ajouter est sans risque.
- Modifier le programme ne modifie jamais l'historique : une séance réalisée garde ses copies
  figées (`sessions`, `sessionExercises`, `sets`).
- Les écrans n'importent que `src/data` (son `index.ts`), jamais Dexie ni `db.ts` directement.
- `src/data/programs.ts` n'écrit que dans `programs` et `programWorkouts`. En rotation, le cycle
  suit l'ordre des séances ; `finishSession` et `skipPlannedWorkout` (`sessions.ts`) le font avancer.
- `src/data/sessions.ts` ne modifie le programme que dans deux cas : avancer la rotation, et
  « remplacer aussi dans le programme » (qui passe par `replacePlannedExercise`).
- Une série « compte » (volume, records, stats) si elle est validée, complète et n'est pas un
  échauffement : toujours passer par `isCountedSet` (`calc.ts`), jamais refaire ce tri à la main.
- Records en direct : charge la plus lourde, meilleur 1RM estimé (Epley, 12 répétitions au plus),
  plus de répétitions à la même charge. Il faut faire strictement mieux, et la première séance
  d'un exercice n'en bat aucun.
- Le minuteur de repos et la séance « passée » du jour vivent dans les réglages (`restTimer`,
  `skippedDay`), pas dans l'état de l'écran : ils survivent à une fermeture de l'appli.
- Une erreur à montrer à l'utilisateur est une `AppError` avec un message en français.
  Ne pas la nommer `DataError` : Dexie réserve ce nom et l'emballerait.
- Aucun backend, aucun compte, aucune donnée envoyée ailleurs. Pas de localStorage pour les données.
- L'adresse du site ne doit jamais changer : ne renommer ni le dépôt ni le compte GitHub.

## Façon de travailler

- Répondre en français, en tutoyant, avec des explications simples et sans jargon.
- Avancer par étapes testables et dire à chaque fois comment tester sur l'iPhone.
- Avant toute mise en ligne, `npm test` et `npm run build` doivent passer.
- Une branche par étape (`etape-N-...`). La mise en ligne se fait en fusionnant la branche dans
  `main` : un envoi sur `main` lance les tests puis publie le site. Demander l'accord de
  l'utilisateur avant de fusionner, car cela met à jour l'appli sur son téléphone.

## Adresse du site

https://sharko1394-jpg.github.io/suivi-muscu/ (dépôt `sharko1394-jpg/suivi-muscu`).
Les données de l'utilisateur sont attachées à cette adresse.

## Choix validés avec l'utilisateur

- Hébergement : GitHub Pages, mise en ligne automatique par `.github/workflows/deploy.yml`.
- Exercices au poids du corps : la charge saisie est le lest ajouté (0 kg = poids de corps seul).
- Haltères : on saisit la charge d'un seul haltère.
- Records « pour N répétitions » : au moins N répétitions (80 kg × 9 compte pour 8).
- Séries d'échauffement exclues des records, du volume et des statistiques.
- Pas des boutons +/− : 2,5 kg et 1 répétition par défaut, réglable globalement et par exercice.
- La semaine commence le lundi.
- Superset : le repos démarre après le dernier exercice du groupe.
- iPhone : pas de vibration possible ; le minuteur ne sonne que si l'appli est à l'écran.

## Conseils (onglet Conseils, `src/data/coach.ts`)

- Objectif réglable (Force 3–6 rép., 6–12 séries/sem. ; Muscle 8–12, 10–20 ; Endurance 15–20, 8–16),
  stocké dans le réglage `goal`. La fourchette d'un exercice vient du programme actif s'il y est,
  sinon de l'objectif.
- Charges (double progression) sur la charge la plus lourde de la dernière séance, séries de travail
  seulement (ni échauffement ni drop set) : « Monte » si toutes au plafond (ou la moitié et RPE ≤ 7),
  « Baisse » si nettement sous la fourchette deux fois de suite (retour à la dernière charge réussie,
  sinon −10 %), « Stagne » si aucun progrès depuis 3 séances, sinon « Bientôt » ou « Garde ».
- Volume : séries par muscle et par semaine sur 4 semaines (secondaire = ½ série), comparées à
  l'objectif ; alertes d'équilibre poussée/tirage, haut/bas, quadriceps/ischios.
- Records à venir : record à portée d'après le 1RM estimé récent (dans la fourchette travaillée,
  ± 2 rép.), et projection du 1RM estimé sur 8 semaines jusqu'au prochain palier de 5 kg.
- Six onglets : sur un écran de moins de 420 px, l'onglet ouvert n'affiche que son icône.

## Apparence

- Thème voulu par l'utilisateur (d'après une maquette qu'il a fournie) : gris anthracite très sombre,
  cartes gris foncé aux coins ronds, boutons en pilule, police Poppins (embarquée), rouge
  (`--color-accent`) pour les actions principales, barre d'onglets flottante en verre dépoli
  (classe `glass`) où seul l'onglet ouvert affiche son nom.
- Fond animé en permanence (`src/ui/LiquidBackground.tsx`, WebGL), thème « forge liquide » rouge :
  métal en fusion, formes floues, voiles de chaleur, reflets. Monté une seule
  fois dans `main.tsx`, hors des pages, pour ne jamais se réinitialiser. Il réagit : onde sous le
  doigt à chaque appui, onde de choc dorée à chaque record, ralenti et respiration pendant le repos
  puis vague rouge à la fin (messages envoyés par `src/ui/ambient.ts`). Calculé à 45 % de la
  résolution, 30 images/s sur téléphone, arrêté en arrière-plan, image fixe si « réduire les
  animations », secours en CSS sans WebGL. Cartes et en-têtes translucides pour le laisser voir.
  Il est SOUS tout le contenu (`-z-10` dans `#root`) : avec `z-0`, il masquait tout ce qui n'est
  pas une carte en verre (la séance libre vide paraissait sans bouton ; corrigé en 1.2.1).
- Hiérarchie : grand titre de page, rubriques en petites capitales grises (`sectionTitleClass`),
  chiffres clés en tuiles `StatTile` (le chiffre, puis ce qu'il mesure), réglages −/+ avec le nom
  en petit au-dessus de la valeur, pastilles sur une seule ligne qu'on fait glisser (bord estompé),
  actions annexes en lien discret (ex. « Passer cette séance aujourd'hui »).
- Rouge : `--color-accent` (#b5121b, sombre) pour les fonds ; `--color-accent-bright` pour le
  texte rouge (la classe `text-accent` l'utilise), lisible sur fond sombre.
- Mise en page minimaliste : pas de texte d'explication dans les écrans. Garder seulement les
  messages d'état, d'erreur et de confirmation.
- Types de série : normale, échauffement, drop set, superset, bi-set, échec. Superset et bi-set
  notés sur une série sont de simples étiquettes : ils ne changent pas le minuteur de repos.

## Avancement

1. Données et sauvegarde : fait (avec la base PWA : installation, hors ligne, bandeau de mise à jour)
2. Programme : fait (programmes, séances, exercices prévus, supersets, rotation et jours fixes ;
   l'accueil affiche la séance prévue, sans bouton Démarrer)
3. Accueil et mode séance : fait (démarrer, saisir, minuteur de repos, records en direct, bilan ;
   réglages de séance ; pas de charge par exercice)
4. Historique : fait (liste par mois, calendrier, recherche par exercice ; le bilan sert de page
   de détail ; correction des séries, des notes et du jour ; suppression avec confirmation)
5. Statistiques : fait (courbes par exercice avec filtre de période, tableau des records,
   assiduité, séries par muscle principal et par semaine, poids de corps ; graphiques Recharts
   chargés seulement à l'ouverture de l'onglet)
6. Finitions PWA et README en français : fait (bouton « Rechercher une mise à jour », README).
   La première version (1.0.0) est complète. Restent les idées « second temps » du cahier des
   charges : suggestion de progression, calculateur de disques, échauffements automatiques,
   mensurations et photos.

7. Conseils : fait (version 1.2.0).
8. Lisibilité (hiérarchie, espacements, gris plus clair) et séance libre réparée : fait (version 1.2.1).

## Commandes

- `npm run dev` : appli en développement
- `npm test` : tests automatiques (migrations, sauvegarde, calculs)
- `npm run build` : vérification des types puis fabrication dans `dist/`
- `npm run icons` : régénère les icônes à partir de `public/logo.svg`
