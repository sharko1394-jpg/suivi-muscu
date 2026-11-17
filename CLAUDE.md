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
- Personnalisation (V2) : tout vit dans le tiroir `settings` (réglages `appearance` et `savedThemes`,
  une ligne `fond:<id>` par photo de fond). La forme de la base ne change pas (toujours la version 1) :
  la V1 (étiquette `v1-final`) peut toujours rouvrir les données. `getSettings` ne lit que les clés
  connues (`bulkGet`), jamais les photos. Valeurs toujours passées par `normalizeAppearance`.
- Le thème « Défaut » reproduit exactement la V1 (`DEFAULT_APPEARANCE`, fond `forge`, testé) : ne pas
  modifier ses valeurs d'apparence (couleur, fond, verre, coins, police). Ne jamais changer la
  signature des fichiers de thème (`THEME_FILE_APP`).
- Onglets et accueil de base peuvent évoluer, sans casser ce que l'utilisateur a rangé : un onglet
  nouveau se place juste après celui qui le précède d'origine (`normalizeTabs`) ; un widget de base
  nouveau entre une seule fois dans un accueil déjà enregistré (`HOME_VERSION`, `NEW_HOME_WIDGETS`).
- La séance du jour (widget `plan`) reste toujours sur l'accueil, Aujourd'hui et Réglages restent
  toujours dans les onglets : sans eux, impossible de démarrer une séance ou de revenir en arrière.
- 2.1 : séances passées de la rotation (`skipLog`), objectifs (`personalGoals`) et bilans déjà vus
  (`recapSeen`) vivent aussi dans `settings` : la base reste en version 1. De même en 2.2 : `profile`,
  `nutritionGoal`, et une ligne `nutrition:AAAA-MM-JJ` par jour (repas, pas du jour) que `getSettings` ne lit jamais.
- Exercices au poids du corps : la charge saisie n'est que le lest, jamais de 1RM estimé dessus
  (bibliothèque, bilans) ; on suit les répétitions sans lest.

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
- Huit onglets (avec Nutrition et Bibliothèque) : la barre défile de gauche à droite quand ils ne tiennent pas
  (bords estompés du côté où il en reste), et l'onglet ouvert vient se placer au milieu.

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

## Personnalisation (V2, Réglages → Personnaliser l'appli)

- Données : `src/data/appearanceModel.ts` (types, thèmes prêts à l'emploi, vérification des valeurs),
  `src/data/appearance.ts` (enregistrement, mes thèmes, photos, fichiers de thème),
  `src/data/dashboard.ts` (données des widgets).
- Affichage : `src/ui/theme.ts` pose des variables CSS sur `<html>` (`--color-accent`, verre, flou,
  rayons Tailwind `--radius-*`, police, taille du texte) ; `src/ui/Ambience.tsx` (monté dans
  `main.tsx`) les applique et passe le fond à `LiquidBackground` (mêmes formes, palette en paramètre :
  Forge, Océan, Aurore, Émeraude, Crépuscule, Graphite, Or ; ou couleur unie, dégradé, photo).
- Thème = couleur principale, fond, opacité et flou du verre, coins, police. La taille du texte, les
  animations, les onglets et l'accueil n'en font pas partie.
- Onglets : ordre, masquer (sauf Aujourd'hui et Réglages), renommer, noms (actif / tous / aucun),
  barre flottante ou pleine largeur, onglet d'ouverture. Définitions dans `src/ui/tabs.tsx`.
- Accueil : widgets petits (demi-largeur) ou grands (`src/pages/widgets.tsx`) : séance du jour,
  ma série (séances d'affilée), mes objectifs, fait aujourd'hui, cette semaine, dernière séance,
  prêts à monter, records récents, prochain record, poids de corps, séries de la semaine.
  Accueil de base depuis la 2.1 : séance du jour, ma série et mes objectifs côte à côte, fait aujourd'hui.

## Motivation et bibliothèque (2.1)

- Ma série (`src/data/streak.ts`) : séances d'affilée sans en rater une. Ratée = un jour prévu (jours
  fixes) sans séance avant le jour prévu suivant ; une séance passée en rotation sans entraînement ce
  jour-là ; plus de 7 jours de repos d'affilée. Chaque programme est jugé sur la période où on l'a
  suivi (`scheduleRuns`). Tout est recalculé à partir de l'historique.
- Bilans (`src/data/recap.ts`, page `historique/bilan/AAAA-MM` ou `AAAA`) : carte sur l'accueil le 1er
  du mois (et en janvier pour l'année), lien « Bilan » sur chaque mois de l'Historique, image à
  partager dessinée sur le téléphone. Un bilan n'est marqué « vu » que si sa période est finie.
- Mes objectifs (`src/data/goals.ts`, page `objectifs`) : charge pour N répétitions (0 kg = répétitions
  au poids du corps), poids de corps, nombre de séances ; date limite facultative. Un objectif déjà
  atteint est refusé à la création.
- Bibliothèque (onglet, `src/pages/LibraryPage.tsx`) : tris (plus faits, plus forts, plus de progrès,
  récents, A → Z) et filtre par muscle. Fiche (`ExerciseSheetPage.tsx`) : mannequin animé
  (`src/ui/ExerciseModel.tsx`, positions dans `src/ui/exerciseModels.ts`), étapes, conseils, erreurs
  à éviter (`src/data/exerciseGuide.ts`), stats, conseil de charge, objectifs. Chaque exercice fourni
  doit avoir son mouvement dans `MOVEMENT_OF` (testé) ; un exercice personnel est rattaché d'après
  son nom quand c'est clair.
- Photos : choisies par la vignette « Galerie » (première de la ligne Fond, `accept="image/*"` : sur
  iPhone, le menu propose la Photothèque) ou par « Importer », qui accepte aussi les photos. Réduites
  sur le téléphone (1800 px, JPEG), 8 au plus, incluses dans les sauvegardes.
  Fichier de personnalisation partageable (.json) avec la photo affichée.

## Nutrition et profil (2.2)

- Profil (Réglages → Mon profil, `src/pages/ProfilePage.tsx`) : sexe, date de naissance, taille, poids
  (enregistré comme pesée du jour), travail (assis, debout, physique), pas par jour en moyenne.
  Les pas moyens servent chaque jour, sauf si on note les pas du jour dans Nutrition. L'iPhone ne
  laisse pas une appli web lire l'app Santé : pas de lecture automatique des pas.
- Calculs (`src/data/energy.ts`, purs et testés) : métabolisme de base Mifflin-St Jeor ; vie quotidienne
  = 10 / 25 / 45 % du métabolisme selon le travail ; pas = 0,0005 kcal × pas × kg ; séance = (MET − 1)
  × kg × heures, MET de 3,5 à 5 selon les muscles, réparti entre les exercices ; digestion = 10 %.
  Objectif : sèche −20 %, maintien, prise de masse +10 % ; protéines 2,2 g/kg en sèche, 1,8 sinon ;
  lipides ≥ 0,8 g/kg ; glucides pour le reste. Rythme du poids sur 4 semaines (au moins 3 pesées sur
  7 jours) ; conseil ± 150 kcal hors de la zone (`PACE_RANGE`).
- Onglet Nutrition (`src/pages/NutritionPage.tsx`, données `src/data/nutrition.ts`) : objectif, jour
  (flèches), reste à manger et barres des macros, repas (liste d'aliments `src/data/foods.ts`, récents,
  saisie libre), dépense détaillée, rythme et conseils. Widget « Calories du jour » (pas dans
  l'accueil de base).
- Swipe entre onglets (`src/ui/AppShell.tsx`) : seulement sur les pages d'onglet, geste net et
  horizontal ; ignoré dans les champs, fenêtres, graphiques (`data-no-swipe`) et tout ce qui défile
  de côté.

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
   **V1 finale** : étiquette git `v1-final` (commit 3d0ea87).
9. Personnalisation complète (V2) : fait (version 2.0.0).
10. Ma série, bilans du mois et de l'année, objectifs perso, barre d'onglets qui défile, onglet
    Bibliothèque : fait (version 2.1.0). Les dessins animés restent à affiner au fil des retours.
11. Profil, onglet Nutrition (dépense, repas, sèche / maintien / prise de masse) et swipe entre
    onglets : fait (version 2.2.0).

## Commandes

- `npm run dev` : appli en développement
- `npm test` : tests automatiques (migrations, sauvegarde, calculs)
- `npm run build` : vérification des types puis fabrication dans `dist/`
- `npm run icons` : régénère les icônes à partir de `public/logo.svg`
