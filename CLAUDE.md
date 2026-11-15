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
  suit l'ordre des séances ; l'avancer après une séance réalisée ou passée est le rôle de l'étape 3.
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

## Avancement

1. Données et sauvegarde : fait (avec la base PWA : installation, hors ligne, bandeau de mise à jour)
2. Programme : fait (programmes, séances, exercices prévus, supersets, rotation et jours fixes ;
   l'accueil affiche la séance prévue, sans bouton Démarrer)
3. Accueil et mode séance : à faire
4. Historique : à faire
5. Statistiques : à faire
6. Finitions PWA et README en français : à faire

## Commandes

- `npm run dev` : appli en développement
- `npm test` : tests automatiques (migrations, sauvegarde, calculs)
- `npm run build` : vérification des types puis fabrication dans `dist/`
- `npm run icons` : régénère les icônes à partir de `public/logo.svg`
