import type { Equipment, Exercise } from './types';
import { normalizeText } from './util';

// Fiches de la bibliothèque : comment faire chaque mouvement, les conseils, les erreurs à éviter.
// Les exercices fournis sont rattachés à un mouvement par leur identifiant (builtinExercises.ts) ;
// un exercice personnel est rattaché d'après son nom, quand il ressemble clairement à un mouvement connu.

export type MovementId =
  | 'bench-press'
  | 'incline-press'
  | 'decline-press'
  | 'machine-chest-press'
  | 'dumbbell-fly'
  | 'cable-fly'
  | 'push-up'
  | 'dips'
  | 'pullover'
  | 'pull-up'
  | 'lat-pulldown'
  | 'seated-row'
  | 'straight-arm-pulldown'
  | 'bent-over-row'
  | 'one-arm-row'
  | 'chest-supported-row'
  | 'deadlift'
  | 'back-extension'
  | 'shrug'
  | 'overhead-press'
  | 'seated-press'
  | 'lateral-raise'
  | 'front-raise'
  | 'rear-delt-fly'
  | 'face-pull'
  | 'upright-row'
  | 'curl'
  | 'incline-curl'
  | 'preacher-curl'
  | 'concentration-curl'
  | 'triceps-pushdown'
  | 'overhead-extension'
  | 'skullcrusher'
  | 'bench-dips'
  | 'triceps-kickback'
  | 'wrist-curl'
  | 'squat'
  | 'front-squat'
  | 'goblet-squat'
  | 'hack-squat'
  | 'leg-press'
  | 'leg-extension'
  | 'lunge'
  | 'split-squat'
  | 'romanian-deadlift'
  | 'good-morning'
  | 'lying-leg-curl'
  | 'seated-leg-curl'
  | 'hip-thrust'
  | 'glute-kickback'
  | 'hip-abduction'
  | 'hip-adduction'
  | 'standing-calf-raise'
  | 'seated-calf-raise'
  | 'leg-press-calf'
  | 'crunch'
  | 'cable-crunch'
  | 'hanging-leg-raise'
  | 'knee-raise'
  | 'ab-wheel'
  | 'russian-twist';

/** Dessin animé d'un exercice : celui de son mouvement, ou une variante qui se voit autrement. */
export type ModelId = MovementId | 'low-cable-fly' | 'pec-deck' | 'reverse-pec-deck';

export interface MovementGuide {
  name: string;
  steps: string[];
  tips: string[];
  avoid: string[];
}

export const MOVEMENTS: Record<MovementId, MovementGuide> = {
  'bench-press': {
    name: 'Développé couché',
    steps: [
      'Allonge-toi, les yeux sous la barre, les pieds bien à plat au sol.',
      'Serre les omoplates l’une contre l’autre et garde les fesses sur le banc.',
      'Descends la charge en contrôle jusqu’au bas des pectoraux.',
      'Pousse jusqu’aux bras tendus : la charge finit au-dessus des épaules.',
    ],
    tips: [
      'Coudes à environ 45° du corps : ni collés, ni écartés à angle droit.',
      'Poignets droits, la charge bien au-dessus des avant-bras.',
      'Inspire en descendant, souffle en poussant.',
    ],
    avoid: ['Faire rebondir la charge sur la poitrine.', 'Décoller les fesses ou les pieds pendant l’effort.'],
  },
  'incline-press': {
    name: 'Développé incliné',
    steps: [
      'Règle le dossier entre 30 et 45°, le dos bien calé.',
      'Serre les omoplates, les pieds à plat au sol.',
      'Descends la charge vers le haut des pectoraux, sous les clavicules.',
      'Pousse à la verticale jusqu’aux bras tendus.',
    ],
    tips: [
      'Plus le dossier est relevé, plus les épaules travaillent : reste sous 45°.',
      'Coudes sous la charge, pas écartés à angle droit.',
    ],
    avoid: ['Décoller le dos du dossier pour pousser plus lourd.', 'Descendre la charge vers le cou.'],
  },
  'decline-press': {
    name: 'Développé décliné',
    steps: [
      'Cale tes jambes sous les boudins, la tête plus bas que les hanches.',
      'Prends la barre un peu plus large que les épaules, omoplates serrées.',
      'Descends la barre vers le bas des pectoraux.',
      'Pousse jusqu’aux bras tendus, au-dessus de la poitrine.',
    ],
    tips: ['Fais-toi aider pour sortir la barre : le départ est délicat.', 'Descends lentement.'],
    avoid: ['Laisser la barre filer vers le visage.', 'Rester longtemps la tête en bas entre les séries.'],
  },
  'machine-chest-press': {
    name: 'Développé à la machine',
    steps: [
      'Règle le siège : les poignées arrivent au milieu de la poitrine.',
      'Le dos collé au dossier, saisis les poignées.',
      'Pousse devant toi jusqu’aux bras presque tendus.',
      'Reviens lentement jusqu’à sentir l’étirement des pectoraux.',
    ],
    tips: ['Garde les épaules basses, loin des oreilles.', 'Ne verrouille pas les coudes en fin de poussée.'],
    avoid: ['Décoller le dos du dossier.', 'Laisser les charges claquer entre deux répétitions.'],
  },
  'dumbbell-fly': {
    name: 'Écarté couché',
    steps: [
      'Allonge-toi, les haltères au-dessus de la poitrine, paumes face à face.',
      'Plie très légèrement les coudes et garde cet angle.',
      'Ouvre les bras en arc de cercle jusqu’à sentir l’étirement des pectoraux.',
      'Ramène les haltères au-dessus de la poitrine en serrant les pectoraux.',
    ],
    tips: ['Imagine que tu enlaces un gros tronc d’arbre.', 'Prends plus léger qu’au développé : les bras font levier.'],
    avoid: ['Descendre trop bas : les épaules souffrent.', 'Plier les coudes en remontant : ça devient un développé.'],
  },
  'cable-fly': {
    name: 'Écarté à la poulie',
    steps: [
      'Une poignée dans chaque main, un pied en avant pour l’équilibre.',
      'Penche légèrement le buste, les coudes un peu fléchis.',
      'Ramène les mains l’une vers l’autre devant toi, en arc de cercle.',
      'Reviens lentement en gardant la tension dans les pectoraux.',
    ],
    tips: ['Garde le même angle des coudes du début à la fin.', 'Serre les pectoraux une seconde quand les mains se rejoignent.'],
    avoid: ['Pousser avec les bras comme pour un développé.', 'Laisser les câbles t’ouvrir brusquement les bras.'],
  },
  'push-up': {
    name: 'Pompes',
    steps: [
      'Mains au sol un peu plus larges que les épaules, le corps gainé de la tête aux talons.',
      'Descends la poitrine près du sol, coudes à environ 45° du corps.',
      'Pousse le sol pour remonter jusqu’aux bras tendus.',
    ],
    tips: [
      'Serre les fessiers et les abdos : le bassin ne doit pas tomber.',
      'Trop dur ? Fais-les sur les genoux, ou les mains sur un banc.',
    ],
    avoid: ['Creuser le bas du dos.', 'Écarter les coudes à angle droit.'],
  },
  dips: {
    name: 'Dips',
    steps: [
      'En appui sur les barres, bras tendus, épaules basses.',
      'Penche-toi légèrement en avant et descends en pliant les coudes.',
      'Arrête-toi quand les bras sont à peu près parallèles au sol.',
      'Pousse pour remonter jusqu’aux bras tendus.',
    ],
    tips: ['Buste penché : plus de pectoraux. Buste droit : plus de triceps.', 'Descends lentement, sans à-coups.'],
    avoid: ['Descendre trop bas si les épaules tirent.', 'Hausser les épaules vers les oreilles.'],
  },
  pullover: {
    name: 'Pull-over',
    steps: [
      'Allongé sur le banc, tiens un haltère à deux mains au-dessus de la poitrine.',
      'Coudes légèrement fléchis, descends l’haltère en arc derrière la tête.',
      'Va jusqu’à sentir l’étirement, sans forcer.',
      'Ramène l’haltère au-dessus de la poitrine.',
    ],
    tips: ['Garde les coudes au même angle pendant tout le mouvement.', 'Souffle en remontant.'],
    avoid: ['Plier et tendre les coudes : ce n’est pas une extension des triceps.', 'Cambrer fort le bas du dos.'],
  },
  'pull-up': {
    name: 'Tractions',
    steps: [
      'Suspends-toi à la barre, bras tendus, épaules tirées vers le bas.',
      'Tire les coudes vers le bas et vers l’arrière pour monter.',
      'Monte jusqu’à ce que le menton passe au-dessus de la barre.',
      'Redescends lentement jusqu’aux bras tendus.',
    ],
    tips: ['Pense à amener la poitrine vers la barre.', 'Trop dur ? Utilise un élastique ou la machine d’assistance.'],
    avoid: ['Te balancer pour aider la montée.', 'T’arrêter à mi-chemin en redescendant.'],
  },
  'lat-pulldown': {
    name: 'Tirage vertical',
    steps: [
      'Assieds-toi, les cuisses bloquées sous les boudins, bras tendus vers la barre.',
      'Abaisse les épaules, puis tire la barre vers le haut de la poitrine.',
      'Serre le dos un instant en bas.',
      'Remonte lentement jusqu’aux bras tendus.',
    ],
    tips: ['Buste légèrement penché en arrière, poitrine sortie.', 'Tire avec les coudes, pas avec les mains.'],
    avoid: ['Tirer la barre derrière la nuque.', 'Te pencher loin en arrière pour emmener la charge.'],
  },
  'seated-row': {
    name: 'Tirage horizontal',
    steps: [
      'Assieds-toi, les pieds calés, genoux légèrement fléchis, bras tendus.',
      'Le dos droit, tire la poignée vers le nombril.',
      'Serre les omoplates en fin de mouvement.',
      'Reviens lentement, bras tendus, sans arrondir le dos.',
    ],
    tips: ['Le buste reste presque immobile : ce sont les bras et le dos qui travaillent.', 'Garde les coudes près du corps.'],
    avoid: ['Te balancer d’avant en arrière.', 'Hausser les épaules en tirant.'],
  },
  'straight-arm-pulldown': {
    name: 'Tirage bras tendus',
    steps: [
      'Face à la poulie haute, bras tendus devant toi, buste légèrement penché.',
      'Bras presque tendus, abaisse la barre jusqu’aux cuisses.',
      'Remonte lentement jusqu’à hauteur des yeux.',
    ],
    tips: ['Pousse la barre vers le bas avec le dos, pas avec les triceps.', 'Garde les abdos serrés pour ne pas cambrer.'],
    avoid: ['Plier les coudes en tirant.', 'Bouger le buste pour aider.'],
  },
  'bent-over-row': {
    name: 'Rowing buste penché',
    steps: [
      'Debout, genoux légèrement fléchis, penche le buste en avant, dos plat.',
      'Bras tendus, la charge pend sous les épaules.',
      'Tire la charge vers le bas du ventre en serrant les omoplates.',
      'Redescends lentement jusqu’aux bras tendus.',
    ],
    tips: ['Le dos reste plat du début à la fin : regarde un peu devant toi.', 'Le buste reste fixe, presque parallèle au sol.'],
    avoid: ['Arrondir le bas du dos.', 'Te redresser à chaque répétition pour monter la charge.'],
  },
  'one-arm-row': {
    name: 'Rowing un bras',
    steps: [
      'Un genou et une main sur le banc, le dos plat, l’haltère dans l’autre main.',
      'Tire l’haltère vers la hanche, coude près du corps.',
      'Serre le dos un instant en haut.',
      'Redescends lentement, bras tendu.',
    ],
    tips: ['Pense à monter le coude vers le plafond, pas la main.', 'Garde les épaules à la même hauteur.'],
    avoid: ['Tourner le buste pour monter la charge.', 'Tirer vers la poitrine plutôt que vers la hanche.'],
  },
  'chest-supported-row': {
    name: 'Rowing buste appuyé',
    steps: [
      'Allonge-toi sur le ventre sur un banc incliné, un haltère dans chaque main.',
      'Bras tendus vers le sol, tire les haltères vers les côtes.',
      'Serre les omoplates en haut.',
      'Redescends lentement.',
    ],
    tips: ['Le banc soulage le bas du dos : concentre-toi sur le haut du dos.', 'Garde la poitrine collée au banc.'],
    avoid: ['Décoller la poitrine du banc pour tricher.', 'Hausser les épaules.'],
  },
  deadlift: {
    name: 'Soulevé de terre',
    steps: [
      'Pieds à largeur de hanches, la barre au-dessus du milieu des pieds.',
      'Plie les jambes, attrape la barre juste à l’extérieur des genoux, dos plat.',
      'Pousse le sol avec les jambes en gardant la barre contre les jambes.',
      'Termine debout, hanches tendues, puis redescends en contrôle.',
    ],
    tips: ['Inspire et serre les abdos avant de soulever.', 'La barre reste toujours au contact des jambes.'],
    avoid: ['Arrondir le dos.', 'Tirer avec les bras : ils restent tendus comme des cordes.'],
  },
  'back-extension': {
    name: 'Extensions lombaires',
    steps: [
      'Cale les pieds, le bassin en appui sur le coussin, bras croisés sur la poitrine.',
      'Descends le buste lentement, le dos droit.',
      'Remonte jusqu’à ce que le corps forme une ligne droite.',
    ],
    tips: ['Remonte en serrant les fessiers.', 'Pour plus de difficulté, tiens un disque contre la poitrine.'],
    avoid: ['Remonter au-delà de la ligne droite en cambrant.', 'Donner des à-coups.'],
  },
  shrug: {
    name: 'Shrugs',
    steps: [
      'Debout, la charge dans les mains, bras tendus le long du corps.',
      'Monte les épaules vers les oreilles, le plus haut possible.',
      'Tiens une seconde en haut, puis redescends lentement.',
    ],
    tips: ['Les bras restent tendus : seules les épaules bougent.', 'Monte bien droit, sans rouler les épaules.'],
    avoid: ['Plier les coudes pour aider.', 'Aller trop vite.'],
  },
  'overhead-press': {
    name: 'Développé militaire',
    steps: [
      'Debout, pieds à largeur de hanches, la barre posée à l’avant des épaules.',
      'Serre les abdos et les fessiers.',
      'Pousse la barre à la verticale en reculant un peu la tête pour la laisser passer.',
      'Finis bras tendus au-dessus de la tête, puis redescends en contrôle.',
    ],
    tips: ['Ramène la tête sous la barre dès qu’elle a passé ton visage.', 'Coudes légèrement devant la barre au départ.'],
    avoid: ['Cambrer le bas du dos pour finir la poussée.', 'Pousser la barre loin devant toi.'],
  },
  'seated-press': {
    name: 'Développé épaules assis',
    steps: [
      'Assieds-toi, le dos calé contre le dossier relevé.',
      'La charge à hauteur des oreilles, coudes sous les mains.',
      'Pousse vers le haut jusqu’aux bras presque tendus.',
      'Redescends lentement à hauteur des oreilles.',
    ],
    tips: ['Garde le dos collé au dossier.', 'Coudes légèrement vers l’avant, pas complètement sur les côtés.'],
    avoid: ['Cambrer pour pousser plus lourd.', 'Descendre trop bas.'],
  },
  'lateral-raise': {
    name: 'Élévations latérales',
    steps: [
      'Debout, une charge dans chaque main, bras le long du corps.',
      'Coudes légèrement fléchis, monte les bras sur les côtés.',
      'Arrête-toi à hauteur des épaules, puis redescends lentement.',
    ],
    tips: ['Mène avec les coudes, comme pour verser une carafe d’eau.', 'Prends léger : c’est un petit muscle.'],
    avoid: ['Te balancer pour lancer la charge.', 'Hausser les épaules vers les oreilles.'],
  },
  'front-raise': {
    name: 'Élévations frontales',
    steps: [
      'Debout, une charge dans chaque main devant les cuisses.',
      'Bras presque tendus, monte devant toi jusqu’à hauteur des yeux.',
      'Redescends lentement.',
    ],
    tips: ['Garde le buste immobile.', 'Tu peux alterner bras droit et bras gauche.'],
    avoid: ['Monter plus haut que la tête.', 'Te pencher en arrière.'],
  },
  'rear-delt-fly': {
    name: 'Oiseau',
    steps: [
      'Penche le buste en avant, dos plat, bras pendants.',
      'Coudes légèrement fléchis, ouvre les bras sur les côtés.',
      'Monte jusqu’à hauteur des épaules en serrant le haut du dos.',
      'Redescends lentement.',
    ],
    tips: ['Pense à écarter les mains loin l’une de l’autre, pas à les monter.', 'Prends léger pour bien sentir l’arrière des épaules.'],
    avoid: ['Redresser le buste pendant le mouvement.', 'Tirer avec les bras comme un rowing.'],
  },
  'face-pull': {
    name: 'Face pull',
    steps: [
      'Poulie à hauteur du visage, une corde en main, bras tendus.',
      'Tire la corde vers ton visage en écartant les mains.',
      'Finis les coudes hauts, les mains de chaque côté des oreilles.',
      'Reviens lentement.',
    ],
    tips: ['Excellent pour la posture et la santé des épaules.', 'Garde les coudes au-dessus des poignets.'],
    avoid: ['Te pencher en arrière pour tirer.', 'Prendre trop lourd : la forme compte plus que la charge.'],
  },
  'upright-row': {
    name: 'Rowing menton',
    steps: [
      'Debout, la barre devant les cuisses, mains à largeur d’épaules.',
      'Monte la barre le long du corps en menant avec les coudes.',
      'Arrête-toi quand les coudes sont à hauteur des épaules, puis redescends lentement.',
    ],
    tips: ['Une prise un peu large ménage les épaules.', 'La barre reste près du corps.'],
    avoid: ['Monter les coudes plus haut que les épaules.', 'Prendre de l’élan avec les jambes.'],
  },
  curl: {
    name: 'Curl',
    steps: [
      'Debout, coudes collés au corps, bras tendus.',
      'Plie les coudes pour monter la charge vers les épaules.',
      'Serre les biceps une seconde en haut.',
      'Redescends lentement jusqu’aux bras tendus.',
    ],
    tips: ['Seuls les avant-bras bougent : les coudes restent fixes.', 'La descente lente travaille autant que la montée.'],
    avoid: ['Te balancer pour monter la charge.', 'Avancer les coudes en haut du mouvement.'],
  },
  'incline-curl': {
    name: 'Curl incliné',
    steps: [
      'Assieds-toi sur un banc incliné, bras pendants derrière le corps.',
      'Garde les bras verticaux et plie les coudes.',
      'Monte jusqu’à ce que les avant-bras soient verticaux.',
      'Redescends complètement, bras tendus.',
    ],
    tips: ['L’étirement en bas fait la force de cet exercice : descends bien.', 'Prends plus léger qu’en curl debout.'],
    avoid: ['Avancer les coudes pour aider.', 'Décoller les épaules du dossier.'],
  },
  'preacher-curl': {
    name: 'Curl au pupitre',
    steps: [
      'Assieds-toi, l’arrière des bras bien à plat sur le pupitre.',
      'Plie les coudes pour monter la charge.',
      'Redescends lentement, sans verrouiller les coudes en bas.',
    ],
    tips: ['Le pupitre empêche de tricher : prends une charge modérée.', 'Contrôle la fin de la descente.'],
    avoid: ['Lâcher la charge en bas : le coude encaisse.', 'Décoller les bras du pupitre.'],
  },
  'concentration-curl': {
    name: 'Curl concentré',
    steps: [
      'Assis, le coude calé contre l’intérieur de la cuisse.',
      'Bras tendu, monte l’haltère vers l’épaule.',
      'Serre le biceps en haut, puis redescends lentement.',
    ],
    tips: ['Va doucement : le but est de bien sentir le muscle.', 'L’autre main s’appuie sur la cuisse.'],
    avoid: ['Bouger le haut du bras.', 'Monter avec l’épaule.'],
  },
  'triceps-pushdown': {
    name: 'Extension des triceps à la poulie',
    steps: [
      'Face à la poulie haute, coudes collés au corps.',
      'Pousse vers le bas jusqu’aux bras tendus.',
      'Remonte lentement jusqu’à ce que les avant-bras soient à l’horizontale.',
    ],
    tips: ['Seuls les avant-bras bougent.', 'Garde le buste immobile, légèrement penché.'],
    avoid: ['Écarter les coudes du corps.', 'Te pencher sur la charge pour pousser plus lourd.'],
  },
  'overhead-extension': {
    name: 'Extension au-dessus de la tête',
    steps: [
      'Bras tendus au-dessus de la tête, la charge en main.',
      'Coudes pointés vers le haut, plie-les pour descendre la charge derrière la tête.',
      'Remonte jusqu’aux bras tendus.',
    ],
    tips: ['Coudes serrés, près de la tête.', 'L’étirement derrière la tête fait beaucoup travailler le triceps.'],
    avoid: ['Écarter les coudes.', 'Cambrer le bas du dos : serre les abdos.'],
  },
  skullcrusher: {
    name: 'Barre au front',
    steps: [
      'Allongé sur le banc, la barre au-dessus de la poitrine, bras tendus.',
      'Plie seulement les coudes pour descendre la barre vers le front.',
      'Remonte jusqu’aux bras tendus.',
    ],
    tips: ['Garde les bras un peu inclinés vers la tête : les triceps restent sous tension.', 'La barre EZ ménage les poignets.'],
    avoid: ['Écarter les coudes.', 'Descendre vite : la barre arrive vers le visage.'],
  },
  'bench-dips': {
    name: 'Dips entre deux bancs',
    steps: [
      'Mains sur le bord du banc derrière toi, jambes tendues devant.',
      'Descends les fesses en pliant les coudes.',
      'Arrête-toi quand les bras sont à l’horizontale.',
      'Pousse pour remonter.',
    ],
    tips: ['Garde le dos près du banc.', 'Plus facile : plie les genoux. Plus dur : pose les pieds sur un autre banc.'],
    avoid: ['Descendre trop bas : les épaules souffrent.', 'Écarter les coudes sur les côtés.'],
  },
  'triceps-kickback': {
    name: 'Kickback triceps',
    steps: [
      'Le buste penché en avant, dos plat, le haut du bras le long du corps.',
      'Tends le coude pour amener la charge vers l’arrière.',
      'Reviens lentement à angle droit.',
    ],
    tips: ['Le haut du bras ne bouge pas.', 'Serre le triceps bras tendu.'],
    avoid: ['Balancer le bras.', 'Laisser le coude descendre.'],
  },
  'wrist-curl': {
    name: 'Curl des poignets',
    steps: [
      'Assis, les avant-bras sur les cuisses, les mains dépassent des genoux.',
      'Laisse la barre descendre en ouvrant un peu les doigts.',
      'Enroule les poignets vers le haut.',
    ],
    tips: ['Fais des séries longues, de 15 à 20 répétitions.', 'Seuls les poignets bougent.'],
    avoid: ['Décoller les avant-bras des cuisses.', 'Prendre trop lourd.'],
  },
  squat: {
    name: 'Squat',
    steps: [
      'La barre sur le haut du dos, les pieds un peu plus larges que les hanches.',
      'Inspire, serre les abdos, puis descends en poussant les fesses en arrière.',
      'Descends au moins jusqu’aux cuisses parallèles au sol.',
      'Pousse dans le sol pour remonter.',
    ],
    tips: ['Les genoux suivent la direction des pointes de pieds.', 'Le poids reste sur tout le pied, talons au sol.'],
    avoid: ['Laisser les genoux rentrer vers l’intérieur.', 'Arrondir le bas du dos en bas du mouvement.'],
  },
  'front-squat': {
    name: 'Squat avant',
    steps: [
      'La barre posée à l’avant des épaules, coudes hauts.',
      'Descends en gardant le buste bien droit.',
      'Va jusqu’aux cuisses parallèles au sol, ou plus bas.',
      'Remonte en gardant les coudes hauts.',
    ],
    tips: ['Les coudes hauts empêchent la barre de glisser.', 'Le buste droit fait davantage travailler les cuisses.'],
    avoid: ['Laisser tomber les coudes.', 'Monter sur la pointe des pieds.'],
  },
  'goblet-squat': {
    name: 'Squat gobelet',
    steps: [
      'Tiens un haltère contre la poitrine, à deux mains.',
      'Pieds un peu plus larges que les hanches, descends entre tes jambes.',
      'Garde le buste droit, les coudes à l’intérieur des genoux.',
      'Remonte en poussant dans le sol.',
    ],
    tips: ['Idéal pour apprendre le squat.', 'L’haltère reste collé à la poitrine.'],
    avoid: ['Arrondir le dos.', 'Décoller les talons.'],
  },
  'hack-squat': {
    name: 'Hack squat',
    steps: [
      'Dos et épaules calés contre les coussins, pieds au milieu de la plateforme.',
      'Débloque la sécurité et descends en pliant les genoux.',
      'Descends jusqu’aux cuisses parallèles à la plateforme.',
      'Pousse pour remonter, sans verrouiller les genoux.',
    ],
    tips: ['Pieds plus bas : plus de quadriceps. Plus haut : plus de fessiers.', 'Garde le dos collé au dossier.'],
    avoid: ['Décoller les talons.', 'Verrouiller les genoux en haut.'],
  },
  'leg-press': {
    name: 'Presse à cuisses',
    steps: [
      'Le dos bien calé, les pieds à largeur de hanches sur la plateforme.',
      'Débloque et descends en pliant les genoux vers la poitrine.',
      'Arrête-toi avant que le bas du dos ne décolle.',
      'Pousse pour remonter, sans verrouiller les genoux.',
    ],
    tips: ['Pousse avec tout le pied, talons compris.', 'Les genoux suivent la direction des pieds.'],
    avoid: ['Décoller les fesses du siège en bas.', 'Verrouiller les genoux en haut.'],
  },
  'leg-extension': {
    name: 'Leg extension',
    steps: [
      'Règle la machine : le genou en face de l’axe, le boudin sur le bas des tibias.',
      'Tends les jambes jusqu’à l’horizontale.',
      'Serre les cuisses une seconde en haut.',
      'Redescends lentement.',
    ],
    tips: ['Tiens les poignées pour rester assis.', 'Une descente lente rend l’exercice plus efficace.'],
    avoid: ['Lancer la charge avec un à-coup.', 'Laisser la charge retomber.'],
  },
  lunge: {
    name: 'Fentes',
    steps: [
      'Debout, une charge dans chaque main.',
      'Fais un grand pas en avant.',
      'Descends jusqu’à ce que le genou arrière frôle le sol.',
      'Pousse sur la jambe avant pour revenir.',
    ],
    tips: ['Le genou avant reste au-dessus de la cheville.', 'Garde le buste droit.'],
    avoid: ['Laisser le genou avant rentrer vers l’intérieur.', 'Faire des pas trop courts.'],
  },
  'split-squat': {
    name: 'Squat bulgare',
    steps: [
      'Dos au banc, pose le dessus du pied arrière sur le banc.',
      'Descends en pliant la jambe avant, le genou arrière vers le sol.',
      'Pousse sur le talon avant pour remonter.',
    ],
    tips: ['Trouve la bonne distance au banc avant de prendre des charges.', 'Buste légèrement penché : plus de fessiers.'],
    avoid: ['Pousser avec la jambe arrière.', 'Perdre l’équilibre : va lentement.'],
  },
  'romanian-deadlift': {
    name: 'Soulevé de terre roumain',
    steps: [
      'Debout, la charge devant les cuisses, genoux légèrement fléchis.',
      'Pousse les fesses en arrière en gardant le dos plat.',
      'Descends la charge le long des jambes jusqu’à sentir l’étirement derrière les cuisses.',
      'Remonte en poussant les hanches vers l’avant.',
    ],
    tips: ['Les genoux restent presque fixes : c’est la hanche qui bouge.', 'La charge frôle les jambes.'],
    avoid: ['Arrondir le dos pour descendre plus bas.', 'Plier les genoux comme pour un squat.'],
  },
  'good-morning': {
    name: 'Good morning',
    steps: [
      'La barre sur le haut du dos, genoux légèrement fléchis.',
      'Penche le buste en avant en poussant les fesses en arrière, dos plat.',
      'Descends jusqu’à sentir l’étirement derrière les cuisses.',
      'Remonte en poussant les hanches vers l’avant.',
    ],
    tips: ['Commence léger : c’est un exercice technique.', 'Regarde un peu devant toi.'],
    avoid: ['Arrondir le dos.', 'Descendre plus bas que l’horizontale.'],
  },
  'lying-leg-curl': {
    name: 'Leg curl allongé',
    steps: [
      'Allongé sur le ventre, le boudin juste au-dessus des talons.',
      'Plie les genoux pour amener les talons vers les fesses.',
      'Redescends lentement.',
    ],
    tips: ['Garde les hanches collées au banc.', 'Contrôle la descente.'],
    avoid: ['Lever les fesses pour aider.', 'Laisser la charge retomber.'],
  },
  'seated-leg-curl': {
    name: 'Leg curl assis',
    steps: [
      'Assis, le boudin sous les mollets, la barre de maintien sur les cuisses.',
      'Plie les genoux pour ramener les talons sous le siège.',
      'Remonte lentement.',
    ],
    tips: ['Penche légèrement le buste en avant : les ischios travaillent mieux.', 'Contrôle le retour.'],
    avoid: ['Décoller les cuisses du siège.', 'Faire des à-coups.'],
  },
  'hip-thrust': {
    name: 'Hip thrust',
    steps: [
      'Le haut du dos appuyé sur un banc, la charge sur les hanches, pieds à plat.',
      'Pousse dans les talons pour monter les hanches.',
      'En haut, le corps forme une ligne droite des épaules aux genoux.',
      'Serre les fessiers une seconde, puis redescends.',
    ],
    tips: ['Mets une mousse sur la barre pour protéger les hanches.', 'Menton rentré, regard vers l’avant.'],
    avoid: ['Cambrer le bas du dos en haut.', 'Pousser avec la pointe des pieds.'],
  },
  'glute-kickback': {
    name: 'Kickback fessiers',
    steps: [
      'Attache la sangle à la cheville, les mains sur la machine.',
      'Le buste légèrement penché, pousse la jambe vers l’arrière.',
      'Serre le fessier en fin de mouvement.',
      'Reviens lentement.',
    ],
    tips: ['Le mouvement est court : c’est la hanche qui travaille.', 'Garde le dos immobile.'],
    avoid: ['Cambrer le dos pour monter la jambe plus haut.', 'Balancer la jambe.'],
  },
  'hip-abduction': {
    name: 'Abduction de hanche',
    steps: [
      'Assis, le dos calé, les coussins contre l’extérieur des genoux.',
      'Écarte les genoux le plus loin possible.',
      'Reviens lentement.',
    ],
    tips: ['Penche-toi un peu en avant pour viser davantage les fessiers.', 'Garde une tension constante.'],
    avoid: ['Laisser les charges claquer.', 'Faire des mouvements brusques.'],
  },
  'hip-adduction': {
    name: 'Adduction de hanche',
    steps: [
      'Assis, le dos calé, les coussins contre l’intérieur des genoux.',
      'Serre les jambes l’une contre l’autre.',
      'Reviens lentement en contrôlant l’écartement.',
    ],
    tips: ['Commence avec un écartement confortable.', 'Garde le dos contre le dossier.'],
    avoid: ['Écarter trop au départ.', 'Faire des à-coups.'],
  },
  'standing-calf-raise': {
    name: 'Mollets debout',
    steps: [
      'L’avant des pieds sur la marche, talons dans le vide, épaules sous les coussins.',
      'Descends les talons le plus bas possible.',
      'Monte sur la pointe des pieds le plus haut possible et tiens une seconde.',
    ],
    tips: ['Les genoux restent tendus, sans être verrouillés.', 'L’amplitude compte plus que la charge.'],
    avoid: ['Rebondir en bas.', 'Plier les genoux pour aider.'],
  },
  'seated-calf-raise': {
    name: 'Mollets assis',
    steps: [
      'Assis, l’avant des pieds sur la marche, le coussin sur les cuisses.',
      'Descends les talons le plus bas possible.',
      'Monte sur la pointe des pieds et tiens une seconde.',
    ],
    tips: ['Fais des séries longues et contrôlées.', 'Assis, c’est surtout le bas du mollet qui travaille.'],
    avoid: ['Rebondir en bas.', 'Aller trop vite.'],
  },
  'leg-press-calf': {
    name: 'Mollets à la presse',
    steps: [
      'Assis à la presse, jambes tendues, l’avant des pieds en bas de la plateforme.',
      'Laisse la plateforme ramener les orteils vers toi.',
      'Pousse avec les orteils pour tendre les chevilles.',
    ],
    tips: ['Genoux tendus, mais pas verrouillés.', 'Garde la sécurité en place si la presse en a une.'],
    avoid: ['Plier les genoux.', 'Laisser les pieds glisser vers le bord.'],
  },
  crunch: {
    name: 'Crunch',
    steps: [
      'Allongé sur le dos, genoux pliés, pieds au sol.',
      'Enroule le haut du dos pour décoller les épaules du sol.',
      'Souffle en montant, puis redescends lentement.',
    ],
    tips: ['Le bas du dos reste au sol.', 'Regarde le plafond, pas tes genoux.'],
    avoid: ['Tirer sur la nuque avec les mains.', 'Monter avec de l’élan.'],
  },
  'cable-crunch': {
    name: 'Crunch à la poulie',
    steps: [
      'À genoux face à la poulie haute, la corde de chaque côté de la tête.',
      'Enroule le buste vers le sol en contractant les abdos.',
      'Remonte lentement.',
    ],
    tips: ['Les hanches ne bougent pas : c’est le dos qui s’enroule.', 'Pense à rapprocher les côtes du bassin.'],
    avoid: ['Tirer avec les bras.', 'T’asseoir sur les talons pour aider.'],
  },
  'hanging-leg-raise': {
    name: 'Relevé de jambes suspendu',
    steps: ['Suspends-toi à la barre, bras tendus.', 'Monte les jambes devant toi, sans te balancer.', 'Redescends lentement.'],
    tips: ['Plus facile : jambes pliées. Plus dur : jambes tendues.', 'Enroule le bassin en haut.'],
    avoid: ['Te balancer pour monter les jambes.', 'Laisser tomber les jambes.'],
  },
  'knee-raise': {
    name: 'Relevé de genoux',
    steps: [
      'Le dos contre le dossier, les avant-bras sur les appuis.',
      'Monte les genoux vers la poitrine.',
      'Redescends lentement, sans te balancer.',
    ],
    tips: ['Enroule le bassin en haut du mouvement.', 'Souffle en montant.'],
    avoid: ['Décoller le dos du dossier.', 'Lancer les jambes.'],
  },
  'ab-wheel': {
    name: 'Roulette abdominale',
    steps: [
      'À genoux, la roulette au sol devant toi, bras tendus.',
      'Roule vers l’avant en gardant le dos plat.',
      'Va aussi loin que possible sans creuser le dos.',
      'Reviens en contractant les abdos.',
    ],
    tips: ['Commence par de petites amplitudes.', 'Serre les fessiers pendant tout le mouvement.'],
    avoid: ['Creuser le bas du dos.', 'Aller trop loin trop tôt.'],
  },
  'russian-twist': {
    name: 'Rotations russes',
    steps: [
      'Assis, le buste penché en arrière, les pieds au sol ou décollés.',
      'Tiens une charge devant toi à deux mains.',
      'Tourne le buste d’un côté, puis de l’autre.',
    ],
    tips: ['Les épaules tournent, pas seulement les bras.', 'Garde le dos droit.'],
    avoid: ['Arrondir le dos.', 'Aller trop vite.'],
  },
};

/** Mouvement de chaque exercice fourni (identifiants de builtinExercises.ts). */
const MOVEMENT_OF: Record<string, MovementId> = {
  'ex-developpe-couche-barre': 'bench-press',
  'ex-developpe-couche-halteres': 'bench-press',
  'ex-developpe-couche-smith': 'bench-press',
  'ex-developpe-couche-prise-serree': 'bench-press',
  'ex-developpe-incline-barre': 'incline-press',
  'ex-developpe-incline-halteres': 'incline-press',
  'ex-developpe-incline-smith': 'incline-press',
  'ex-developpe-decline-barre': 'decline-press',
  'ex-developpe-pectoraux-machine': 'machine-chest-press',
  'ex-developpe-incline-machine': 'machine-chest-press',
  'ex-ecarte-couche-halteres': 'dumbbell-fly',
  'ex-ecarte-incline-halteres': 'dumbbell-fly',
  'ex-ecarte-poulie-vis-a-vis': 'cable-fly',
  'ex-ecarte-poulie-basse': 'cable-fly',
  'ex-pec-deck': 'cable-fly',
  'ex-pompes': 'push-up',
  'ex-dips': 'dips',
  'ex-dips-machine': 'dips',
  'ex-pull-over-haltere': 'pullover',
  'ex-tractions-pronation': 'pull-up',
  'ex-tractions-supination': 'pull-up',
  'ex-tractions-prise-neutre': 'pull-up',
  'ex-tractions-assistees': 'pull-up',
  'ex-tirage-vertical-prise-large': 'lat-pulldown',
  'ex-tirage-vertical-prise-serree': 'lat-pulldown',
  'ex-tirage-vertical-supination': 'lat-pulldown',
  'ex-tirage-horizontal-poulie': 'seated-row',
  'ex-rowing-machine': 'seated-row',
  'ex-tirage-bras-tendus': 'straight-arm-pulldown',
  'ex-rowing-barre': 'bent-over-row',
  'ex-rowing-t-bar': 'bent-over-row',
  'ex-rowing-haltere': 'one-arm-row',
  'ex-rowing-buste-appuye': 'chest-supported-row',
  'ex-souleve-de-terre': 'deadlift',
  'ex-extensions-lombaires': 'back-extension',
  'ex-shrugs-barre': 'shrug',
  'ex-shrugs-halteres': 'shrug',
  'ex-developpe-militaire-barre': 'overhead-press',
  'ex-developpe-epaules-halteres': 'seated-press',
  'ex-developpe-epaules-machine': 'seated-press',
  'ex-developpe-epaules-smith': 'seated-press',
  'ex-developpe-arnold': 'seated-press',
  'ex-elevations-laterales-halteres': 'lateral-raise',
  'ex-elevations-laterales-poulie': 'lateral-raise',
  'ex-elevations-laterales-machine': 'lateral-raise',
  'ex-elevations-frontales-halteres': 'front-raise',
  'ex-oiseau-halteres': 'rear-delt-fly',
  'ex-pec-deck-inverse': 'rear-delt-fly',
  'ex-face-pull': 'face-pull',
  'ex-rowing-menton': 'upright-row',
  'ex-curl-barre': 'curl',
  'ex-curl-barre-ez': 'curl',
  'ex-curl-halteres': 'curl',
  'ex-curl-marteau': 'curl',
  'ex-curl-poulie-basse': 'curl',
  'ex-curl-inverse': 'curl',
  'ex-curl-incline-halteres': 'incline-curl',
  'ex-curl-pupitre': 'preacher-curl',
  'ex-curl-machine': 'preacher-curl',
  'ex-curl-concentre': 'concentration-curl',
  'ex-extension-triceps-poulie-barre': 'triceps-pushdown',
  'ex-extension-triceps-poulie-corde': 'triceps-pushdown',
  'ex-extension-triceps-nuque-poulie': 'overhead-extension',
  'ex-extension-triceps-nuque-haltere': 'overhead-extension',
  'ex-barre-au-front': 'skullcrusher',
  'ex-dips-banc': 'bench-dips',
  'ex-kickback-triceps': 'triceps-kickback',
  'ex-curl-poignets': 'wrist-curl',
  'ex-squat-barre': 'squat',
  'ex-squat-smith': 'squat',
  'ex-squat-avant': 'front-squat',
  'ex-squat-gobelet': 'goblet-squat',
  'ex-hack-squat': 'hack-squat',
  'ex-presse-a-cuisses': 'leg-press',
  'ex-leg-extension': 'leg-extension',
  'ex-fentes-halteres': 'lunge',
  'ex-fentes-marchees': 'lunge',
  'ex-squat-bulgare': 'split-squat',
  'ex-souleve-de-terre-roumain': 'romanian-deadlift',
  'ex-souleve-de-terre-roumain-halteres': 'romanian-deadlift',
  'ex-good-morning': 'good-morning',
  'ex-leg-curl-allonge': 'lying-leg-curl',
  'ex-leg-curl-assis': 'seated-leg-curl',
  'ex-hip-thrust-barre': 'hip-thrust',
  'ex-hip-thrust-machine': 'hip-thrust',
  'ex-kickback-fessiers-poulie': 'glute-kickback',
  'ex-abduction-machine': 'hip-abduction',
  'ex-adduction-machine': 'hip-adduction',
  'ex-mollets-debout': 'standing-calf-raise',
  'ex-mollets-assis': 'seated-calf-raise',
  'ex-mollets-presse': 'leg-press-calf',
  'ex-crunch': 'crunch',
  'ex-crunch-machine': 'crunch',
  'ex-crunch-poulie': 'cable-crunch',
  'ex-releve-de-jambes-suspendu': 'hanging-leg-raise',
  'ex-releve-de-genoux-chaise-romaine': 'knee-raise',
  'ex-roulette-abdominale': 'ab-wheel',
  'ex-rotations-russes': 'russian-twist',
};

/** Variantes qui se dessinent autrement que leur mouvement. */
const MODEL_OF: Record<string, ModelId> = {
  'ex-ecarte-poulie-basse': 'low-cable-fly',
  'ex-pec-deck': 'pec-deck',
  'ex-pec-deck-inverse': 'reverse-pec-deck',
};

/** Précision propre à une variante. */
const EXTRA_TIPS: Record<string, string> = {
  'ex-developpe-couche-prise-serree': 'Mains à largeur d’épaules et coudes près du corps : les triceps travaillent davantage.',
  'ex-ecarte-poulie-basse': 'Poulies en bas : les mains montent en arc jusqu’au menton, pour le haut des pectoraux.',
  'ex-pec-deck': 'Coudes à hauteur des épaules, ramène les bras devant toi.',
  'ex-dips-machine': 'Assis, pousse les poignées vers le bas jusqu’aux bras tendus.',
  'ex-tractions-supination': 'Paumes vers toi : les biceps aident davantage.',
  'ex-tractions-prise-neutre': 'Paumes face à face : la prise la plus douce pour les épaules.',
  'ex-tractions-assistees': 'Plus l’assistance est lourde, plus c’est facile : diminue-la au fil des séances.',
  'ex-tirage-vertical-prise-serree': 'Prise serrée : tire vers le bas de la poitrine.',
  'ex-tirage-vertical-supination': 'Paumes vers toi : les biceps participent davantage.',
  'ex-rowing-machine': 'Garde la poitrine contre l’appui.',
  'ex-rowing-t-bar': 'La barre entre les jambes, tire la poignée vers le ventre.',
  'ex-developpe-arnold': 'Commence paumes vers toi et tourne les mains en poussant, pour finir paumes vers l’avant.',
  'ex-elevations-laterales-poulie': 'À la poulie, la tension reste là même bras le long du corps.',
  'ex-pec-deck-inverse': 'Face à la machine, poitrine contre le dossier, ouvre les bras vers l’arrière.',
  'ex-curl-marteau': 'Paumes face à face, comme pour tenir un marteau : l’avant-bras travaille aussi.',
  'ex-curl-barre-ez': 'La barre EZ ménage les poignets.',
  'ex-curl-poulie-basse': 'Face à la poulie basse : la tension reste constante tout du long.',
  'ex-curl-inverse': 'Paumes vers le bas : les avant-bras travaillent beaucoup.',
  'ex-extension-triceps-poulie-corde': 'Écarte la corde en bas pour finir le mouvement.',
  'ex-extension-triceps-nuque-poulie': 'Dos à la poulie, la corde derrière la tête.',
  'ex-squat-smith': 'Avance un peu les pieds devant la barre : le mouvement reste naturel.',
  'ex-fentes-marchees': 'Enchaîne les pas en avançant, en alternant les jambes.',
  'ex-hip-thrust-machine': 'Règle le coussin sur le haut des hanches.',
  'ex-souleve-de-terre-roumain-halteres': 'Les haltères frôlent l’avant des jambes.',
  'ex-crunch-machine': 'Règle la machine : les coussins sur le haut de la poitrine.',
};

const EQUIPMENT_TIPS: Partial<Record<Equipment, string>> = {
  barre: 'Place les mains à la même distance du centre de la barre.',
  halteres: 'Chaque côté travaille seul : garde la même amplitude à gauche et à droite.',
  machine: 'Règle le siège avant la première série, et retiens ce réglage pour la prochaine fois.',
  poulie: 'Garde la tension du câble : la charge ne se repose pas entre deux répétitions.',
  smith: 'La barre suit un rail : place-toi pour que le mouvement reste naturel.',
  'poids-du-corps': 'Trop facile ? Ajoute du lest et note-le comme charge dans ta séance.',
  elastique: 'Plus l’élastique est étiré, plus c’est dur : choisis bien ta position de départ.',
};

/** Mots du nom (sans accents) → mouvement. Le premier qui correspond l'emporte : les plus précis d'abord. */
const NAME_RULES: [string[], MovementId][] = [
  [['roumain'], 'romanian-deadlift'],
  [['souleve de terre'], 'deadlift'],
  [['deadlift'], 'deadlift'],
  [['bulgare'], 'split-squat'],
  [['squat avant'], 'front-squat'],
  [['front squat'], 'front-squat'],
  [['gobelet'], 'goblet-squat'],
  [['goblet'], 'goblet-squat'],
  [['hack'], 'hack-squat'],
  [['squat'], 'squat'],
  [['presse', 'mollet'], 'leg-press-calf'],
  [['mollet', 'assis'], 'seated-calf-raise'],
  [['mollet'], 'standing-calf-raise'],
  [['presse'], 'leg-press'],
  [['leg extension'], 'leg-extension'],
  [['leg curl', 'assis'], 'seated-leg-curl'],
  [['leg curl'], 'lying-leg-curl'],
  [['fente'], 'lunge'],
  [['hip thrust'], 'hip-thrust'],
  [['pont fessier'], 'hip-thrust'],
  [['kickback', 'fess'], 'glute-kickback'],
  [['kickback'], 'triceps-kickback'],
  [['abduct'], 'hip-abduction'],
  [['adduct'], 'hip-adduction'],
  [['good morning'], 'good-morning'],
  [['developpe incline'], 'incline-press'],
  [['developpe decline'], 'decline-press'],
  [['developpe militaire'], 'overhead-press'],
  [['arnold'], 'seated-press'],
  [['developpe epaule'], 'seated-press'],
  [['developpe', 'machine'], 'machine-chest-press'],
  [['developpe couche'], 'bench-press'],
  [['bench'], 'bench-press'],
  [['ecarte', 'haltere'], 'dumbbell-fly'],
  [['ecarte'], 'cable-fly'],
  [['butterfly'], 'cable-fly'],
  [['pec deck'], 'cable-fly'],
  [['pompe'], 'push-up'],
  [['dips', 'banc'], 'bench-dips'],
  [['dips'], 'dips'],
  [['pull over'], 'pullover'],
  [['pullover'], 'pullover'],
  [['traction'], 'pull-up'],
  [['tirage bras tendu'], 'straight-arm-pulldown'],
  [['tirage vertical'], 'lat-pulldown'],
  [['tirage poitrine'], 'lat-pulldown'],
  [['tirage horizontal'], 'seated-row'],
  [['menton'], 'upright-row'],
  [['rowing', 'un bras'], 'one-arm-row'],
  [['rowing'], 'bent-over-row'],
  [['shrug'], 'shrug'],
  [['oiseau'], 'rear-delt-fly'],
  [['laterale'], 'lateral-raise'],
  [['frontale'], 'front-raise'],
  [['face pull'], 'face-pull'],
  [['poignet'], 'wrist-curl'],
  [['pupitre'], 'preacher-curl'],
  [['concentr'], 'concentration-curl'],
  [['curl', 'incline'], 'incline-curl'],
  [['curl'], 'curl'],
  [['barre au front'], 'skullcrusher'],
  [['triceps', 'nuque'], 'overhead-extension'],
  [['triceps', 'tete'], 'overhead-extension'],
  [['triceps', 'poulie'], 'triceps-pushdown'],
  [['lombaire'], 'back-extension'],
  [['crunch', 'poulie'], 'cable-crunch'],
  [['crunch'], 'crunch'],
  [['releve de jambes'], 'hanging-leg-raise'],
  [['releve de genoux'], 'knee-raise'],
  [['roulette'], 'ab-wheel'],
  [['russe'], 'russian-twist'],
];

/** Mouvement qu'un nom d'exercice décrit clairement ; null s'il n'y a pas de correspondance sûre. */
export function guessMovement(name: string): MovementId | null {
  const text = ` ${normalizeText(name).replace(/[^a-z0-9]+/g, ' ')} `;
  return NAME_RULES.find(([words]) => words.every((word) => text.includes(word)))?.[1] ?? null;
}

export interface ExerciseGuide {
  movement: MovementId | null;
  model: ModelId | null;
  /** Rattaché d'après le nom (exercice personnel). */
  guessed: boolean;
  steps: string[];
  tips: string[];
  avoid: string[];
}

/** Fiche d'un exercice : celle de son mouvement, avec la précision de la variante et du matériel. */
export function exerciseGuide(exercise: Pick<Exercise, 'id' | 'name' | 'equipment'>): ExerciseGuide {
  const known = MOVEMENT_OF[exercise.id];
  const movement = known ?? guessMovement(exercise.name);
  const equipmentTip = EQUIPMENT_TIPS[exercise.equipment];
  if (!movement) {
    return { movement: null, model: null, guessed: false, steps: [], tips: equipmentTip ? [equipmentTip] : [], avoid: [] };
  }
  const guide = MOVEMENTS[movement];
  const extra = EXTRA_TIPS[exercise.id];
  return {
    movement,
    model: MODEL_OF[exercise.id] ?? movement,
    guessed: known === undefined,
    steps: guide.steps,
    tips: [...(extra ? [extra] : []), ...guide.tips, ...(equipmentTip ? [equipmentTip] : [])],
    avoid: guide.avoid,
  };
}
