import type { ModelId } from '../data';

// Dessins animés des exercices : un mannequin qui fait le mouvement, vu de profil (tourné vers la droite),
// de face ou de dos. Chaque modèle donne deux positions (ou plus) ; l'animation passe de l'une à l'autre.
//
// Angles en degrés : 0 = vers le haut, 90 = vers l'avant (la droite), 180 = vers le bas.
// Repère : 240 × 190 (de y = −16 à 174), sol à y = 168.

export type Pt = [number, number];

/** Bras : par angles (absolus, ou relatifs au buste avec `rel`), ou par la main (le coude se place seul). */
export interface ArmSpec {
  ua?: number;
  fa?: number;
  rel?: boolean;
  hand?: Pt;
  /** Côté où plie le coude quand on donne la main : 1 ou −1. */
  bend?: 1 | -1;
  /** Raccourci de perspective (négatif : le segment passe de l'autre côté). */
  uaScale?: number;
  faScale?: number;
  /** Poignet, relatif à l'avant-bras. */
  hn?: number;
}

export interface LegSpec {
  th?: number;
  sh?: number;
  ankle?: Pt;
  bend?: 1 | -1;
  /** Angle du pied (absolu) ; par défaut perpendiculaire au tibia, vers l'avant. */
  ft?: number;
  thScale?: number;
  shScale?: number;
}

export interface Pose {
  hip: Pt;
  /** Buste : de la hanche vers l'épaule. */
  t: number;
  /** Tête, relative au buste. */
  hd?: number;
  /** Haussement d'épaules (shrug), en unités du dessin. */
  lift?: number;
  arm: ArmSpec;
  /** Bras du fond (de profil) ou bras gauche de l'image (de face) ; par défaut, comme `arm` (en miroir de face). */
  arm2?: ArmSpec;
  leg: LegSpec;
  leg2?: LegSpec;
  /** De face : buste raccourci (penché vers l'avant ou l'arrière) et rotation des épaules (−1 à 1). */
  tScale?: number;
  twist?: number;
}

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { kind: 'line'; from: Pt; to: Pt; w?: number }
  | { kind: 'circle'; at: Pt; r: number };

export type Hold = 'auto' | 'none' | 'barbell' | 'dumbbell' | 'handle' | 'bar' | 'rope' | 'plate' | 'wheel';

export interface ModelDef {
  view: 'side' | 'front' | 'back';
  frames: Pose[];
  env?: Shape[];
  /** Ce que tiennent les mains ; « auto » : d'après le matériel de l'exercice. */
  hold?: Hold;
  /** La charge est dans les deux mains (haltères). */
  holdBoth?: boolean;
  /** Poulie(s) : un câble va de là jusqu'à la main (ou la cheville). */
  cable?: Pt[];
  /** Câble toujours dessiné (sinon seulement pour un exercice à la poulie). */
  forceCable?: boolean;
  cableTo?: 'hand' | 'ankle';
  /** Barre posée sur le corps. */
  load?: 'back-bar' | 'front-bar' | 'hip-bar';
  /** Coussins qui suivent le corps. */
  pads?: { joint: 'ankle' | 'knee' | 'shoulder' | 'forearm'; side: 'front' | 'back' | 'top' | 'out' | 'in'; r?: number }[];
  /** Coussin du dossier qui suit le dos (hack squat). */
  backPad?: boolean;
  /** Plateau sous les pieds qui suit le pied (presse). */
  footPlate?: boolean;
  ground?: boolean;
}

// ---------- Décors ----------

const flatBench = (x: number, y: number, w: number): Shape[] => [
  { kind: 'rect', x, y, w, h: 6, r: 3 },
  { kind: 'line', from: [x + 12, y + 6], to: [x + 12, 168], w: 4 },
  { kind: 'line', from: [x + w - 12, y + 6], to: [x + w - 12, 168], w: 4 },
];

const seat = (x: number, y: number, w = 40): Shape[] => [
  { kind: 'rect', x, y, w, h: 6, r: 3 },
  { kind: 'line', from: [x + w / 2, y + 6], to: [x + w / 2, 168], w: 4 },
];

const backrest = (x: number, top: number, bottom: number): Shape => ({ kind: 'rect', x, y: top, w: 7, h: bottom - top, r: 3 });

const pulley = (at: Pt): Shape => ({ kind: 'circle', at, r: 4 });

// ---------- Positions de base ----------

const STRAIGHT: LegSpec = { th: 180, sh: 180 };
const STAND = { hip: [120, 87] as Pt, t: 0, leg: STRAIGHT };
const HANG: ArmSpec = { ua: 180, fa: 180 };

/** Allongé sur un banc plat, la tête à gauche. */
const SUPINE = { hip: [134, 112] as Pt, t: 270, leg: { th: 112, sh: 182 } };
const SUPINE_BENCH = flatBench(62, 120, 92);

/** Assis droit sur un siège avec dossier. */
const SEATED = { hip: [112, 124] as Pt, t: 0, leg: { th: 90, sh: 180 } };
const SEATED_ENV: Shape[] = [...seat(92, 131), backrest(95, 52, 131)];

export const MODELS: Record<ModelId, ModelDef> = {
  // ----- Pectoraux -----
  'bench-press': {
    view: 'side',
    env: SUPINE_BENCH,
    frames: [
      { ...SUPINE, arm: { hand: [90, 64], bend: 1 } },
      { ...SUPINE, arm: { hand: [104, 102], bend: 1 } },
    ],
  },
  'incline-press': {
    view: 'side',
    env: [
      { kind: 'line', from: [127, 129], to: [80, 89], w: 7 },
      ...seat(114, 127, 38),
      { kind: 'line', from: [104, 112], to: [104, 168], w: 4 },
    ],
    frames: [
      { hip: [130, 120], t: 310, leg: { th: 98, sh: 180 }, arm: { hand: [97, 44], bend: 1 } },
      { hip: [130, 120], t: 310, leg: { th: 98, sh: 180 }, arm: { hand: [108, 89], bend: 1 } },
    ],
  },
  'decline-press': {
    view: 'side',
    env: [
      { kind: 'line', from: [150, 115], to: [82, 133], w: 7 },
      { kind: 'line', from: [118, 126], to: [118, 168], w: 4 },
      { kind: 'circle', at: [188, 112], r: 6 },
      { kind: 'line', from: [188, 118], to: [176, 168], w: 4 },
    ],
    frames: [
      { hip: [140, 108], t: 255, leg: { th: 60, sh: 150 }, arm: { hand: [97, 70], bend: 1 } },
      { hip: [140, 108], t: 255, leg: { th: 60, sh: 150 }, arm: { hand: [108, 107], bend: 1 } },
    ],
  },
  'machine-chest-press': {
    view: 'side',
    hold: 'handle',
    env: [...seat(92, 133), backrest(94, 58, 133)],
    frames: [
      { hip: [110, 126], t: 0, leg: { th: 90, sh: 180 }, arm: { hand: [126, 86], bend: 1 } },
      { hip: [110, 126], t: 0, leg: { th: 90, sh: 180 }, arm: { hand: [158, 86], bend: 1 } },
    ],
  },
  'dumbbell-fly': {
    // Vu du dessus : allongé sur le banc, les bras s'ouvrent puis se referment au-dessus de la poitrine.
    view: 'front',
    hold: 'dumbbell',
    holdBoth: true,
    ground: false,
    env: [{ kind: 'rect', x: 107, y: 36, w: 26, h: 96, r: 8 }],
    frames: [
      { hip: [120, 118], t: 0, leg: { th: 178, sh: 178, shScale: 0.4 }, arm: { ua: 92, fa: 98, uaScale: -0.3, faScale: -0.3 } },
      { hip: [120, 118], t: 0, leg: { th: 178, sh: 178, shScale: 0.4 }, arm: { ua: 92, fa: 98 } },
    ],
  },
  'cable-fly': {
    view: 'front',
    hold: 'handle',
    holdBoth: true,
    forceCable: true,
    cable: [
      [214, 12],
      [26, 12],
    ],
    env: [
      { kind: 'line', from: [214, 4], to: [214, 168], w: 4 },
      { kind: 'line', from: [26, 4], to: [26, 168], w: 4 },
      pulley([214, 12]),
      pulley([26, 12]),
    ],
    frames: [
      { ...STAND, leg: { th: 177, sh: 180 }, arm: { ua: 72, fa: 84 } },
      { ...STAND, leg: { th: 177, sh: 180 }, arm: { ua: 205, fa: 215, uaScale: 0.42, faScale: 0.42 } },
    ],
  },
  'low-cable-fly': {
    view: 'front',
    hold: 'handle',
    holdBoth: true,
    forceCable: true,
    cable: [
      [214, 158],
      [26, 158],
    ],
    env: [
      { kind: 'line', from: [214, 4], to: [214, 168], w: 4 },
      { kind: 'line', from: [26, 4], to: [26, 168], w: 4 },
      pulley([214, 158]),
      pulley([26, 158]),
    ],
    frames: [
      { ...STAND, leg: { th: 177, sh: 180 }, arm: { ua: 150, fa: 145 } },
      { ...STAND, leg: { th: 177, sh: 180 }, arm: { ua: -30, fa: -40, uaScale: 0.45, faScale: 0.45 } },
    ],
  },
  'pec-deck': {
    view: 'front',
    hold: 'none',
    pads: [{ joint: 'forearm', side: 'front' }],
    env: [
      { kind: 'rect', x: 96, y: 108, w: 48, h: 10, r: 4 },
      { kind: 'rect', x: 101, y: 36, w: 38, h: 72, r: 6 },
    ],
    frames: [
      { hip: [120, 112], t: 0, leg: { th: 178, sh: 180, thScale: 0.4 }, arm: { ua: 90, fa: 0 } },
      { hip: [120, 112], t: 0, leg: { th: 178, sh: 180, thScale: 0.4 }, arm: { ua: 90, fa: 0, uaScale: -0.4 } },
    ],
  },
  'push-up': {
    view: 'side',
    frames: [
      { hip: [117, 131], t: 293, leg: { th: 113, sh: 113, ft: 165 }, arm: { hand: [80, 164], bend: -1 } },
      { hip: [112, 152], t: 277.5, leg: { th: 97.5, sh: 97.5, ft: 172 }, arm: { hand: [80, 164], bend: -1 } },
    ],
  },
  dips: {
    view: 'side',
    hold: 'none',
    env: [
      { kind: 'circle', at: [121, 96], r: 3.5 },
      { kind: 'line', from: [121, 100], to: [121, 168], w: 4 },
    ],
    frames: [
      { hip: [122, 86], t: -5, leg: { th: 172, sh: 222 }, arm: { hand: [121, 93], bend: 1 } },
      { hip: [114, 104], t: 20, leg: { th: 165, sh: 215 }, arm: { hand: [121, 93], bend: 1 } },
    ],
  },
  pullover: {
    view: 'side',
    hold: 'dumbbell',
    env: SUPINE_BENCH,
    frames: [
      { ...SUPINE, arm: { ua: 8, fa: 14 } },
      { ...SUPINE, arm: { ua: -95, fa: -100 } },
    ],
  },

  // ----- Dos -----
  'pull-up': {
    view: 'side',
    hold: 'none',
    ground: false,
    env: [
      { kind: 'line', from: [56, 8], to: [124, 8], w: 4 },
      { kind: 'circle', at: [124, 8], r: 3.5 },
    ],
    frames: [
      { hip: [121, 104], t: 0, leg: { th: 172, sh: 235 }, arm: { hand: [124, 8], bend: 1 } },
      { hip: [120, 66], t: -8, leg: { th: 168, sh: 230 }, arm: { hand: [124, 8], bend: 1 } },
    ],
  },
  'lat-pulldown': {
    view: 'side',
    hold: 'bar',
    forceCable: true,
    cable: [[118, -6]],
    env: [
      ...seat(98, 133),
      { kind: 'line', from: [60, -6], to: [150, -6], w: 4 },
      pulley([118, -6]),
      { kind: 'circle', at: [156, 110], r: 6 },
    ],
    frames: [
      { hip: [118, 126], t: -8, leg: { th: 85, sh: 180 }, arm: { hand: [112, 36], bend: 1 } },
      { hip: [118, 126], t: -14, leg: { th: 85, sh: 180 }, arm: { hand: [124, 78], bend: 1 } },
    ],
  },
  'seated-row': {
    view: 'side',
    hold: 'handle',
    forceCable: true,
    cable: [[200, 128]],
    env: [
      ...flatBench(66, 139, 48),
      { kind: 'rect', x: 176, y: 114, w: 6, h: 34, r: 3 },
      { kind: 'line', from: [204, 20], to: [204, 168], w: 4 },
      pulley([200, 128]),
    ],
    frames: [
      { hip: [92, 132], t: 15, leg: { th: 80, sh: 100 }, arm: { hand: [150, 106], bend: 1 } },
      { hip: [92, 132], t: -6, leg: { th: 80, sh: 100 }, arm: { hand: [112, 113], bend: 1 } },
    ],
  },
  'straight-arm-pulldown': {
    view: 'side',
    hold: 'bar',
    forceCable: true,
    cable: [[206, 2]],
    env: [{ kind: 'line', from: [210, -10], to: [210, 168], w: 4 }, pulley([206, 2])],
    frames: [
      { hip: [112, 86], t: 20, leg: { th: 176, sh: 184 }, arm: { ua: 62, fa: 62 } },
      { hip: [112, 86], t: 20, leg: { th: 176, sh: 184 }, arm: { ua: 158, fa: 158 } },
    ],
  },
  'bent-over-row': {
    view: 'side',
    holdBoth: true,
    frames: [
      { hip: [100, 88], t: 62, leg: { ankle: [104, 164], bend: -1 }, arm: { hand: [140, 114], bend: 1 } },
      { hip: [100, 88], t: 62, leg: { ankle: [104, 164], bend: -1 }, arm: { hand: [127, 84], bend: 1 } },
    ],
  },
  'one-arm-row': {
    view: 'side',
    hold: 'dumbbell',
    env: flatBench(56, 133, 114),
    frames: [
      {
        hip: [88, 88],
        t: 82,
        leg: { ankle: [100, 164], bend: -1 },
        leg2: { th: 180, sh: 270 },
        arm: { hand: [134, 130], bend: 1 },
        arm2: { hand: [142, 128], bend: 1 },
      },
      {
        hip: [88, 88],
        t: 82,
        leg: { ankle: [100, 164], bend: -1 },
        leg2: { th: 180, sh: 270 },
        arm: { hand: [104, 96], bend: 1 },
        arm2: { hand: [142, 128], bend: 1 },
      },
    ],
  },
  'chest-supported-row': {
    view: 'side',
    hold: 'dumbbell',
    holdBoth: true,
    env: [
      { kind: 'line', from: [99, 111], to: [140, 70], w: 8 },
      { kind: 'line', from: [122, 96], to: [122, 168], w: 4 },
    ],
    frames: [
      { hip: [96, 100], t: 45, leg: { ankle: [94, 164], bend: -1 }, arm: { hand: [134, 116], bend: 1 } },
      { hip: [96, 100], t: 45, leg: { ankle: [94, 164], bend: -1 }, arm: { hand: [112, 92], bend: 1 } },
    ],
  },
  deadlift: {
    view: 'side',
    holdBoth: true,
    frames: [
      { hip: [100, 120], t: 63, leg: { ankle: [126, 164], bend: -1 }, arm: { hand: [136, 150], bend: 1 } },
      { hip: [128, 86], t: 0, leg: { ankle: [126, 164], bend: -1 }, arm: { hand: [131, 92], bend: 1 } },
    ],
  },
  'back-extension': {
    view: 'side',
    hold: 'none',
    env: [
      { kind: 'circle', at: [57, 142], r: 6 },
      { kind: 'circle', at: [121, 104], r: 7 },
      { kind: 'line', from: [57, 148], to: [121, 111], w: 4 },
      { kind: 'line', from: [57, 148], to: [57, 168], w: 4 },
      { kind: 'line', from: [121, 111], to: [112, 168], w: 4 },
    ],
    frames: [
      { hip: [120, 92], t: 45, leg: { th: 225, sh: 225 }, arm: { ua: 150, fa: 20, rel: true } },
      { hip: [120, 92], t: 160, leg: { th: 225, sh: 225 }, arm: { ua: 150, fa: 20, rel: true } },
    ],
  },
  shrug: {
    view: 'side',
    holdBoth: true,
    frames: [
      { ...STAND, arm: HANG },
      { ...STAND, lift: 7, arm: HANG },
    ],
  },

  // ----- Épaules -----
  'overhead-press': {
    view: 'side',
    frames: [
      { ...STAND, arm: { hand: [132, 38], bend: 1 } },
      { ...STAND, arm: { hand: [121, -5], bend: 1 } },
    ],
  },
  'seated-press': {
    view: 'side',
    holdBoth: true,
    env: SEATED_ENV,
    frames: [
      { ...SEATED, arm: { ua: 0, fa: 0, uaScale: -0.35 } },
      { ...SEATED, arm: { ua: 0, fa: 0 } },
    ],
  },
  'lateral-raise': {
    view: 'front',
    holdBoth: true,
    frames: [
      { ...STAND, leg: { th: 178, sh: 180 }, arm: { ua: 172, fa: 176 } },
      { ...STAND, leg: { th: 178, sh: 180 }, arm: { ua: 92, fa: 100 } },
    ],
  },
  'front-raise': {
    view: 'side',
    holdBoth: true,
    frames: [
      { ...STAND, arm: { ua: 172, fa: 172 } },
      { ...STAND, arm: { ua: 82, fa: 82 } },
    ],
  },
  'rear-delt-fly': {
    // De dos, penché en avant : les bras s'ouvrent sur les côtés.
    view: 'back',
    holdBoth: true,
    frames: [
      { hip: [120, 89], t: 0, tScale: 0.55, leg: { th: 178, sh: 182 }, arm: { ua: 182, fa: 184 } },
      { hip: [120, 89], t: 0, tScale: 0.55, leg: { th: 178, sh: 182 }, arm: { ua: 96, fa: 102 } },
    ],
  },
  'reverse-pec-deck': {
    view: 'back',
    hold: 'handle',
    holdBoth: true,
    env: [{ kind: 'rect', x: 96, y: 108, w: 48, h: 10, r: 4 }],
    frames: [
      { hip: [120, 112], t: 0, leg: { th: 178, sh: 180, thScale: 0.4 }, arm: { ua: 90, fa: 90, uaScale: -0.3, faScale: -0.3 } },
      { hip: [120, 112], t: 0, leg: { th: 178, sh: 180, thScale: 0.4 }, arm: { ua: 90, fa: 92 } },
    ],
  },
  'face-pull': {
    view: 'side',
    hold: 'rope',
    forceCable: true,
    cable: [[206, 28]],
    env: [{ kind: 'line', from: [210, -10], to: [210, 168], w: 4 }, pulley([206, 28])],
    frames: [
      { hip: [112, 87], t: -4, leg: STRAIGHT, arm: { hand: [160, 34], bend: -1 } },
      { hip: [112, 87], t: -4, leg: STRAIGHT, arm: { hand: [118, 26], bend: -1 } },
    ],
  },
  'upright-row': {
    view: 'side',
    frames: [
      { ...STAND, arm: { hand: [123, 92], bend: -1 } },
      { ...STAND, arm: { hand: [127, 40], bend: -1 } },
    ],
  },

  // ----- Bras -----
  curl: {
    view: 'side',
    holdBoth: true,
    cable: [[196, 160]],
    env: [],
    frames: [
      { ...STAND, arm: { ua: 178, fa: 178 } },
      { ...STAND, arm: { ua: 176, fa: 30 } },
    ],
  },
  'incline-curl': {
    view: 'side',
    holdBoth: true,
    env: [{ kind: 'line', from: [113, 133], to: [82, 79], w: 7 }, ...seat(104, 135, 36)],
    frames: [
      { hip: [120, 128], t: -30, leg: { th: 85, sh: 175 }, arm: { ua: 182, fa: 182 } },
      { hip: [120, 128], t: -30, leg: { th: 85, sh: 175 }, arm: { ua: 182, fa: 40 } },
    ],
  },
  'preacher-curl': {
    view: 'side',
    env: [
      { kind: 'line', from: [109, 90], to: [125, 109], w: 8 },
      { kind: 'line', from: [124, 112], to: [124, 168], w: 4 },
      ...seat(86, 131, 36),
    ],
    frames: [
      { hip: [104, 124], t: 10, leg: { th: 90, sh: 180 }, arm: { ua: 140, fa: 146 } },
      { hip: [104, 124], t: 10, leg: { th: 90, sh: 180 }, arm: { ua: 140, fa: 8 } },
    ],
  },
  'concentration-curl': {
    view: 'side',
    hold: 'dumbbell',
    env: flatBench(66, 135, 56),
    frames: [
      { hip: [100, 128], t: 40, leg: { th: 85, sh: 175 }, arm: { ua: 172, fa: 176 }, arm2: { ua: 150, fa: 110 } },
      { hip: [100, 128], t: 40, leg: { th: 85, sh: 175 }, arm: { ua: 172, fa: 30 }, arm2: { ua: 150, fa: 110 } },
    ],
  },
  'triceps-pushdown': {
    view: 'side',
    hold: 'bar',
    forceCable: true,
    cable: [[152, -8]],
    env: [{ kind: 'line', from: [100, -8], to: [160, -8], w: 4 }, pulley([152, -8])],
    frames: [
      { hip: [118, 87], t: 8, leg: { th: 178, sh: 182 }, arm: { ua: 176, fa: 62 } },
      { hip: [118, 87], t: 8, leg: { th: 178, sh: 182 }, arm: { ua: 176, fa: 178 } },
    ],
  },
  'overhead-extension': {
    view: 'side',
    hold: 'dumbbell',
    cable: [[40, 150]],
    frames: [
      { hip: [118, 87], t: -4, leg: STRAIGHT, arm: { ua: -6, fa: 196 } },
      { hip: [118, 87], t: -4, leg: STRAIGHT, arm: { ua: -6, fa: 354 } },
    ],
  },
  skullcrusher: {
    view: 'side',
    env: SUPINE_BENCH,
    frames: [
      { ...SUPINE, arm: { ua: -10, fa: -10 } },
      { ...SUPINE, arm: { ua: -10, fa: -120 } },
    ],
  },
  'bench-dips': {
    view: 'side',
    hold: 'none',
    env: flatBench(20, 138, 62),
    frames: [
      { hip: [84, 128], t: 0, leg: { th: 115, sh: 115, ft: 25 }, arm: { hand: [78, 136], bend: 1 } },
      { hip: [82, 148], t: -2, leg: { th: 100, sh: 100, ft: 25 }, arm: { hand: [78, 136], bend: 1 } },
    ],
  },
  'triceps-kickback': {
    view: 'side',
    holdBoth: true,
    frames: [
      { hip: [100, 92], t: 72, leg: { ankle: [110, 164], bend: -1 }, arm: { ua: 250, fa: 180 } },
      { hip: [100, 92], t: 72, leg: { ankle: [110, 164], bend: -1 }, arm: { ua: 250, fa: 252 } },
    ],
  },
  'wrist-curl': {
    view: 'side',
    env: flatBench(70, 133, 52),
    frames: [
      { hip: [100, 126], t: 28, leg: { th: 90, sh: 180 }, arm: { ua: 158, fa: 92, hn: 70 } },
      { hip: [100, 126], t: 28, leg: { th: 90, sh: 180 }, arm: { ua: 158, fa: 92, hn: -50 } },
    ],
  },

  // ----- Jambes -----
  squat: {
    view: 'side',
    hold: 'none',
    load: 'back-bar',
    frames: [
      { hip: [124, 86], t: 6, leg: { ankle: [124, 164], bend: -1 }, arm: { ua: 200, fa: 4, rel: true } },
      { hip: [94, 128], t: 42, leg: { ankle: [124, 164], bend: -1 }, arm: { ua: 200, fa: 4, rel: true } },
    ],
  },
  'front-squat': {
    view: 'side',
    hold: 'none',
    load: 'front-bar',
    frames: [
      { hip: [124, 86], t: 2, leg: { ankle: [124, 164], bend: -1 }, arm: { ua: 100, fa: 280, rel: true } },
      { hip: [98, 130], t: 22, leg: { ankle: [124, 164], bend: -1 }, arm: { ua: 100, fa: 280, rel: true } },
    ],
  },
  'goblet-squat': {
    view: 'side',
    hold: 'dumbbell',
    frames: [
      { hip: [124, 86], t: 4, leg: { ankle: [124, 164], bend: -1 }, arm: { ua: 165, fa: 15, rel: true } },
      { hip: [97, 130], t: 28, leg: { ankle: [124, 164], bend: -1 }, arm: { ua: 165, fa: 15, rel: true } },
    ],
  },
  'hack-squat': {
    view: 'side',
    hold: 'none',
    backPad: true,
    env: [
      { kind: 'line', from: [132, 170], to: [66, 30], w: 4 },
      { kind: 'line', from: [126, 167], to: [162, 155], w: 5 },
    ],
    frames: [
      { hip: [109, 92], t: -25, leg: { ankle: [140, 160], bend: -1 }, arm: { ua: 170, fa: 20, rel: true } },
      { hip: [126, 128], t: -25, leg: { ankle: [140, 160], bend: -1 }, arm: { ua: 170, fa: 20, rel: true } },
    ],
  },
  'leg-press': {
    view: 'side',
    hold: 'none',
    footPlate: true,
    env: [
      { kind: 'line', from: [97, 139], to: [40, 109], w: 8 },
      ...seat(86, 135, 30),
      { kind: 'line', from: [112, 150], to: [214, 48], w: 3 },
    ],
    frames: [
      { hip: [96, 128], t: -62, leg: { ankle: [152, 80], bend: -1, ft: -45 }, arm: { ua: 180, fa: 185, rel: true } },
      { hip: [96, 128], t: -62, leg: { ankle: [126, 106], bend: -1, ft: -45 }, arm: { ua: 180, fa: 185, rel: true } },
    ],
  },
  'leg-extension': {
    view: 'side',
    hold: 'none',
    pads: [{ joint: 'ankle', side: 'front' }],
    env: [...seat(84, 125, 46), { kind: 'line', from: [95, 120], to: [86, 66], w: 7 }],
    frames: [
      { hip: [104, 118], t: -10, leg: { th: 92, sh: 182 }, arm: { ua: 180, fa: 150, rel: true } },
      { hip: [104, 118], t: -10, leg: { th: 92, sh: 96 }, arm: { ua: 180, fa: 150, rel: true } },
    ],
  },
  lunge: {
    view: 'side',
    holdBoth: true,
    frames: [
      {
        hip: [112, 94],
        t: 0,
        leg: { ankle: [146, 164], bend: -1 },
        leg2: { ankle: [78, 160], bend: -1, ft: 120 },
        arm: HANG,
      },
      {
        hip: [112, 126],
        t: 0,
        leg: { ankle: [146, 164], bend: -1 },
        leg2: { ankle: [78, 160], bend: -1, ft: 120 },
        arm: HANG,
      },
    ],
  },
  'split-squat': {
    view: 'side',
    holdBoth: true,
    env: flatBench(28, 122, 52),
    frames: [
      {
        hip: [110, 96],
        t: 6,
        leg: { ankle: [142, 164], bend: -1 },
        leg2: { ankle: [72, 116], bend: -1, ft: 250 },
        arm: HANG,
      },
      {
        hip: [106, 124],
        t: 10,
        leg: { ankle: [142, 164], bend: -1 },
        leg2: { ankle: [72, 116], bend: -1, ft: 250 },
        arm: HANG,
      },
    ],
  },
  'romanian-deadlift': {
    view: 'side',
    holdBoth: true,
    frames: [
      { hip: [124, 87], t: 0, leg: { ankle: [128, 164], bend: -1 }, arm: { hand: [127, 92], bend: 1 } },
      { hip: [104, 92], t: 75, leg: { ankle: [128, 164], bend: -1 }, arm: { hand: [140, 128], bend: 1 } },
    ],
  },
  'good-morning': {
    view: 'side',
    hold: 'none',
    load: 'back-bar',
    frames: [
      { hip: [124, 87], t: 2, leg: { ankle: [126, 164], bend: -1 }, arm: { ua: 200, fa: 4, rel: true } },
      { hip: [104, 90], t: 80, leg: { ankle: [126, 164], bend: -1 }, arm: { ua: 200, fa: 4, rel: true } },
    ],
  },
  'lying-leg-curl': {
    view: 'side',
    hold: 'none',
    pads: [{ joint: 'ankle', side: 'back' }],
    env: flatBench(66, 114, 130),
    frames: [
      { hip: [108, 107], t: 90, leg: { th: 270, sh: 268 }, arm: { ua: 160, fa: 175 } },
      { hip: [108, 107], t: 90, leg: { th: 270, sh: 372 }, arm: { ua: 160, fa: 175 } },
    ],
  },
  'seated-leg-curl': {
    view: 'side',
    hold: 'none',
    pads: [{ joint: 'ankle', side: 'back' }],
    env: [...seat(84, 125, 46), { kind: 'line', from: [95, 120], to: [86, 66], w: 7 }, { kind: 'circle', at: [138, 105], r: 6.5 }],
    frames: [
      { hip: [104, 118], t: -12, leg: { th: 92, sh: 100 }, arm: { ua: 180, fa: 150, rel: true } },
      { hip: [104, 118], t: -12, leg: { th: 92, sh: 205 }, arm: { ua: 180, fa: 150, rel: true } },
    ],
  },
  'hip-thrust': {
    view: 'side',
    hold: 'none',
    load: 'hip-bar',
    env: flatBench(36, 132, 48),
    frames: [
      { hip: [114, 150], t: 306, leg: { ankle: [164, 162], bend: -1 }, arm: { ua: -190, fa: -180, rel: true } },
      { hip: [124, 124], t: 270, leg: { ankle: [164, 162], bend: -1 }, arm: { ua: -190, fa: -180, rel: true } },
    ],
  },
  'glute-kickback': {
    view: 'side',
    hold: 'none',
    forceCable: true,
    cableTo: 'ankle',
    cable: [[170, 156]],
    env: [{ kind: 'line', from: [170, -6], to: [170, 168], w: 4 }, pulley([170, 156])],
    frames: [
      { hip: [110, 86], t: 22, leg: { th: 172, sh: 186 }, leg2: STRAIGHT, arm: { hand: [164, 60], bend: 1 } },
      { hip: [110, 86], t: 22, leg: { th: 222, sh: 234 }, leg2: STRAIGHT, arm: { hand: [164, 60], bend: 1 } },
    ],
  },
  'hip-abduction': {
    view: 'front',
    hold: 'none',
    pads: [{ joint: 'knee', side: 'out' }],
    env: [
      { kind: 'rect', x: 96, y: 108, w: 48, h: 10, r: 4 },
      { kind: 'rect', x: 101, y: 40, w: 38, h: 68, r: 6 },
    ],
    frames: [
      { hip: [120, 112], t: 0, leg: { th: 200, sh: 180, thScale: 0.4 }, arm: { ua: 172, fa: 190 } },
      { hip: [120, 112], t: 0, leg: { th: 140, sh: 172, thScale: 0.4 }, arm: { ua: 172, fa: 190 } },
    ],
  },
  'hip-adduction': {
    view: 'front',
    hold: 'none',
    pads: [{ joint: 'knee', side: 'in' }],
    env: [
      { kind: 'rect', x: 96, y: 108, w: 48, h: 10, r: 4 },
      { kind: 'rect', x: 101, y: 40, w: 38, h: 68, r: 6 },
    ],
    frames: [
      { hip: [120, 112], t: 0, leg: { th: 140, sh: 172, thScale: 0.4 }, arm: { ua: 172, fa: 190 } },
      { hip: [120, 112], t: 0, leg: { th: 196, sh: 180, thScale: 0.4 }, arm: { ua: 172, fa: 190 } },
    ],
  },
  'standing-calf-raise': {
    view: 'side',
    hold: 'none',
    pads: [{ joint: 'shoulder', side: 'top' }],
    env: [{ kind: 'rect', x: 128, y: 150, w: 52, h: 18, r: 3 }],
    frames: [
      { hip: [122.7, 78.5], t: 0, leg: { th: 180, sh: 180, ft: 60 }, arm: { ua: 160, fa: 20, rel: true } },
      { hip: [124.8, 62.8], t: 0, leg: { th: 180, sh: 180, ft: 135 }, arm: { ua: 160, fa: 20, rel: true } },
    ],
  },
  'seated-calf-raise': {
    view: 'side',
    hold: 'none',
    pads: [{ joint: 'knee', side: 'top' }],
    env: [...seat(80, 119), { kind: 'rect', x: 146, y: 152, w: 32, h: 16, r: 3 }],
    frames: [
      { hip: [100, 112], t: 0, leg: { ankle: [141.7, 158.5], bend: -1, ft: 60 }, arm: { ua: 165, fa: 95 } },
      { hip: [100, 112], t: 0, leg: { ankle: [143.8, 142.8], bend: -1, ft: 135 }, arm: { ua: 165, fa: 95 } },
    ],
  },
  'leg-press-calf': {
    view: 'side',
    hold: 'none',
    footPlate: true,
    env: [
      { kind: 'line', from: [97, 139], to: [40, 109], w: 8 },
      ...seat(86, 135, 30),
      { kind: 'line', from: [112, 150], to: [214, 48], w: 3 },
    ],
    frames: [
      { hip: [96, 128], t: -62, leg: { ankle: [150, 82], bend: -1, ft: -48 }, arm: { ua: 180, fa: 185, rel: true } },
      { hip: [96, 128], t: -62, leg: { ankle: [150, 82], bend: -1, ft: 0 }, arm: { ua: 180, fa: 185, rel: true } },
    ],
  },

  // ----- Abdominaux -----
  crunch: {
    view: 'side',
    hold: 'none',
    frames: [
      { hip: [124, 160], t: 270, leg: { ankle: [170, 162], bend: -1 }, arm: { ua: 160, fa: 20, rel: true } },
      { hip: [124, 160], t: 300, leg: { ankle: [170, 162], bend: -1 }, arm: { ua: 160, fa: 20, rel: true } },
    ],
  },
  'cable-crunch': {
    view: 'side',
    hold: 'rope',
    forceCable: true,
    cable: [[190, -6]],
    env: [{ kind: 'line', from: [150, -6], to: [196, -6], w: 4 }, pulley([190, -6])],
    frames: [
      { hip: [128, 120], t: 12, leg: { th: 180, sh: 270 }, arm: { ua: 45, fa: 250, rel: true } },
      { hip: [128, 120], t: 70, leg: { th: 180, sh: 270 }, arm: { ua: 45, fa: 250, rel: true } },
    ],
  },
  'hanging-leg-raise': {
    view: 'side',
    hold: 'none',
    ground: false,
    env: [
      { kind: 'line', from: [56, -8], to: [124, -8], w: 4 },
      { kind: 'circle', at: [124, -8], r: 3.5 },
    ],
    frames: [
      { hip: [121, 86], t: 0, leg: { th: 178, sh: 180 }, arm: { hand: [124, -8], bend: 1 } },
      { hip: [121, 86], t: 4, leg: { th: 92, sh: 92 }, arm: { hand: [124, -8], bend: 1 } },
    ],
  },
  'knee-raise': {
    view: 'side',
    hold: 'none',
    ground: false,
    env: [
      { kind: 'rect', x: 102, y: 30, w: 7, h: 84, r: 3 },
      { kind: 'rect', x: 110, y: 78, w: 42, h: 6, r: 3 },
      { kind: 'line', from: [105, 114], to: [105, 168], w: 4 },
    ],
    frames: [
      { hip: [118, 92], t: 0, leg: { th: 178, sh: 180 }, arm: { ua: 180, fa: 90 } },
      { hip: [118, 92], t: 0, leg: { th: 72, sh: 182 }, arm: { ua: 180, fa: 90 } },
    ],
  },
  'ab-wheel': {
    view: 'side',
    hold: 'wheel',
    frames: [
      { hip: [72, 120], t: 60, leg: { th: 183, sh: 270 }, arm: { hand: [110, 148], bend: 1 } },
      { hip: [106, 143], t: 82, leg: { th: 245, sh: 270 }, arm: { hand: [196, 148], bend: 1 } },
    ],
  },
  'russian-twist': {
    view: 'front',
    hold: 'plate',
    frames: [
      {
        hip: [120, 132],
        t: 0,
        tScale: 0.85,
        twist: 0.7,
        leg: { th: 25, sh: 175, thScale: 0.45, shScale: 0.8 },
        arm: { ua: 155, fa: 125 },
        arm2: { ua: 120, fa: 95 },
      },
      {
        hip: [120, 132],
        t: 0,
        tScale: 0.85,
        twist: -0.7,
        leg: { th: 25, sh: 175, thScale: 0.45, shScale: 0.8 },
        arm: { ua: 240, fa: 265 },
        arm2: { ua: 205, fa: 235 },
      },
    ],
  },
};
