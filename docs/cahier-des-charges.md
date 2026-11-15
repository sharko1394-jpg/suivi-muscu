# Projet : appli web de suivi de musculation (PWA)

## Contexte
Je veux une application web personnelle pour suivre mes performances à la salle.
Je suis le seul utilisateur. Je l'utilise sur mon téléphone pendant mes séances,
souvent d'une main, parfois sans réseau. Je ne suis pas développeur : explique-moi
simplement ce que tu fais et ce que je dois faire de mon côté.

## Deux contraintes non négociables

### 1. Installable sur téléphone
- PWA complète : manifest, icônes, service worker, plein écran, ajout à l'écran
  d'accueil sur iPhone (Safari) et Android (Chrome).
- Fonctionne à 100 % hors ligne une fois installée.

### 2. Mises à jour sans jamais perdre mes données
- Données stockées dans IndexedDB (via Dexie.js), pas dans localStorage.
- Schéma de base versionné, avec une migration écrite pour chaque changement.
  Ne jamais renommer la base, ne jamais la vider, ne jamais la réinitialiser.
- Demander le stockage persistant au premier lancement (navigator.storage.persist()).
- Export complet en un fichier JSON et import depuis ce fichier (page Réglages),
  plus un export CSV de l'historique.
- Rappel discret si ma dernière sauvegarde date de plus de 14 jours.
- Quand une nouvelle version est déployée : bandeau « Mise à jour disponible »
  avec un bouton, sans toucher aux données.
- Chaque saisie est enregistrée immédiatement. Si l'appli se ferme en pleine
  séance, je reprends exactement où j'en étais.
- Garde une couche d'accès aux données isolée pour pouvoir ajouter plus tard une
  synchro cloud, mais ne la construis pas maintenant.

## Fonctionnalités

### Programme (modifiable librement)
- Plusieurs programmes possibles, un seul actif. Dupliquer, archiver, renommer.
- Un programme contient des séances (ex. Upper A, Lower A, Full body B).
- Deux modes de planification au choix :
  - jours fixes (lundi = telle séance) ;
  - rotation (A → B → C → A...), la prochaine séance est la suivante du cycle,
    quel que soit le jour.
- Pour chaque exercice d'une séance : nombre de séries, fourchette de répétitions
  (ex. 8–12), charge cible facultative, temps de repos, note permanente
  (ex. « siège cran 4 »), possibilité de superset.
- Réordonner par glisser-déposer, ajouter, supprimer, remplacer.
- Règle essentielle : modifier le programme ne modifie jamais l'historique.
  Chaque séance réalisée garde une copie figée de ce qui a été fait.

### Accueil : séance du jour
- Affiche la séance prévue aujourd'hui avec un gros bouton « Démarrer ».
- Je peux choisir une autre séance, la passer, ou lancer une séance libre.

### Mode séance
- Pour chaque série : charge et répétitions, RPE facultatif.
- Champs préremplis avec ma dernière performance, et rappel visible
  « la dernière fois : 80 kg × 8, 8, 7 ».
- Boutons +/− (2,5 kg et 1 rép. par défaut, pas réglable) pour éviter le clavier.
- Valider une série lance automatiquement le minuteur de repos, avec vibration
  et son à la fin.
- Types de série : échauffement, normale, dégressive, jusqu'à l'échec.
- Ajouter ou retirer une série, ajouter un exercice non prévu, remplacer un
  exercice (pour cette séance seulement ou définitivement dans le programme).
- Notes : une par exercice et une pour la séance entière.
- Badge « Record » en direct quand je bats un record.
- Chrono de la séance, écran maintenu allumé (Wake Lock).
- Écran de fin : durée, volume total, records battus, comparaison avec la
  même séance la fois précédente.

### Historique (archive)
- Vue calendrier et vue liste, recherche par exercice.
- Détail complet de chaque séance, avec les notes.
- Possibilité de corriger ou supprimer une séance passée (avec confirmation).

### Statistiques et progression
- Par exercice : graphiques de la charge max, du 1RM estimé (formule d'Epley),
  du volume et de la meilleure série, avec filtre de période.
- Tableau de mes records par exercice (meilleure charge pour 1, 3, 5, 8, 10 rép.).
- Nombre de séries par groupe musculaire et par semaine.
- Assiduité : séances par semaine, série de semaines consécutives.
- Suivi du poids de corps avec courbe.

### Bibliothèque d'exercices
- Liste de base des exercices de musculation courants, en français, avec groupe
  musculaire principal et secondaire et type de matériel.
- Création et modification de mes propres exercices.

### À faire dans un second temps (pas dans la première version)
- Suggestion de progression : quand j'atteins le haut de la fourchette sur
  toutes les séries, proposer d'augmenter la charge.
- Calculateur de disques pour charger la barre.
- Séries d'échauffement générées automatiquement.
- Mensurations et photos de progression.

## Design
- Interface en français, unités en kg.
- Mobile d'abord, thème sombre par défaut, gros boutons, fort contraste.
- Navigation par barre en bas : Aujourd'hui, Programme, Historique, Stats, Réglages.
- En mode séance, le minimum de taps possible pour enregistrer une série.

## Technique
- Vite + React + TypeScript, Tailwind CSS, Dexie.js, vite-plugin-pwa, Recharts.
  Si tu préfères autre chose, dis-le et justifie avant de commencer.
- Aucun backend, aucun compte, aucune donnée envoyée ailleurs.
- Tests automatiques sur les migrations de données, l'export/import et les
  calculs (records, 1RM, volume).
- Hébergement gratuit en HTTPS (GitHub Pages, Cloudflare Pages ou Netlify).
  L'adresse du site ne doit jamais changer, car les données sont liées à elle.

## Méthode de travail
1. Avant de coder, pose-moi tes questions et propose-moi un plan avec le modèle
   de données. Attends ma validation.
2. Construis par étapes testables : données et sauvegarde, programme, mode
   séance, historique, stats, puis PWA et déploiement.
3. À chaque étape, dis-moi comment tester sur mon téléphone.
4. Termine par un README en français : comment installer l'appli sur mon
   téléphone, comment la mettre à jour, comment sauvegarder et restaurer.

## Critères de réussite
- Je peux faire une séance complète en mode avion.
- Je déploie une mise à jour et toutes mes séances sont toujours là.
- J'exporte, je désinstalle, je réinstalle, j'importe : tout revient.
- Je modifie mon programme et mes anciennes séances restent intactes.
