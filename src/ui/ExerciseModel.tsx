import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Equipment, ModelId, Muscle } from '../data';
import {
  MODELS,
  type ArmSpec,
  type Hold,
  type LegSpec,
  type ModelDef,
  type Pose,
  type Pt,
  type Shape,
} from './exerciseModels';

// Mannequin animé : il fait le mouvement, les muscles travaillés s'allument
// (le principal en couleur vive, les autres plus doucement).

/** Longueurs et épaisseurs du mannequin, en unités du dessin. */
const L = { torso: 44, neck: 5, head: 8.5, ua: 26, fa: 24, hand: 7, th: 40, sh: 38, foot: 13 };
const W = { torso: 15, neck: 7, ua: 9, fa: 7.5, hand: 6, th: 12.5, sh: 9.5, foot: 5 };
/** Un aller-retour complet. */
const PERIOD_MS = 2800;
/** Membres du côté opposé (de profil) : un peu décalés, pour la profondeur. */
const FAR: Pt = [-2.5, -2];

const COLORS = {
  body: 'rgb(236 236 244 / 0.36)',
  far: 'rgb(236 236 244 / 0.17)',
  env: 'rgb(255 255 255 / 0.09)',
  envLine: 'rgb(255 255 255 / 0.13)',
  gear: 'rgb(255 255 255 / 0.62)',
  gearFill: 'rgb(16 16 18 / 0.55)',
  cable: 'rgb(255 255 255 / 0.38)',
  hot: 'var(--color-accent-bright)',
};

// ---------- Géométrie ----------

const rad = (a: number) => (a * Math.PI) / 180;
const dir = (a: number): Pt => [Math.sin(rad(a)), -Math.cos(rad(a))];
const add = (p: Pt, v: Pt, k = 1): Pt => [p[0] + v[0] * k, p[1] + v[1] * k];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const angleOf = (v: Pt) => (Math.atan2(v[0], -v[1]) * 180) / Math.PI;
const unit = (v: Pt): Pt => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

/** Deux segments de la racine vers la cible ; l'articulation du milieu plie du côté `bend`. */
function ik(root: Pt, target: Pt, l1: number, l2: number, bend: number): [number, number] {
  const v = sub(target, root);
  const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(v[0], v[1])));
  const base = angleOf(v);
  const alpha = (Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))) * 180) / Math.PI;
  const a1 = base + bend * alpha;
  const joint = add(root, dir(a1), l1);
  return [a1, angleOf(sub(add(root, dir(base), d), joint))];
}

interface Limb {
  root: Pt;
  mid: Pt;
  end: Pt;
  /** Bout de la main ou du pied. */
  tip: Pt;
  /** Prise : là où la main tient la charge. */
  grip: Pt;
}

function solveArm(spec: ArmSpec, root: Pt, torso: number): Limb {
  const s1 = spec.uaScale ?? 1;
  const s2 = spec.faScale ?? 1;
  let a1: number;
  let a2: number;
  if (spec.hand) [a1, a2] = ik(root, spec.hand, L.ua, L.fa, spec.bend ?? 1);
  else {
    const offset = spec.rel ? torso : 0;
    a1 = (spec.ua ?? 180) + offset;
    a2 = (spec.fa ?? 180) + offset;
  }
  const mid = add(root, dir(a1), L.ua * s1);
  const end = add(mid, dir(a2), L.fa * s2);
  const handDir = dir(a2 + (spec.hn ?? 0));
  const sign = s2 < 0 ? -1 : 1;
  return { root, mid, end, tip: add(end, handDir, L.hand * sign), grip: add(end, handDir, 3.5 * sign) };
}

function solveLeg(spec: LegSpec, root: Pt, front: boolean, side: 1 | -1): Limb {
  const s1 = spec.thScale ?? 1;
  const s2 = spec.shScale ?? 1;
  let a1: number;
  let a2: number;
  if (spec.ankle) [a1, a2] = ik(root, spec.ankle, L.th * s1, L.sh * s2, spec.bend ?? -1);
  else {
    a1 = spec.th ?? 180;
    a2 = spec.sh ?? 180;
  }
  const mid = add(root, dir(a1), L.th * s1);
  const end = add(mid, dir(a2), L.sh * s2);
  // De face, le pied pointe vers nous : un petit bout vers l'extérieur.
  const foot = front ? 180 - 40 * side : (spec.ft ?? a2 - 90);
  return { root, mid, end, tip: add(end, dir(foot), front ? 6 : L.foot), grip: end };
}

const shift = (limb: Limb, by: Pt): Limb => ({
  root: add(limb.root, by),
  mid: add(limb.mid, by),
  end: add(limb.end, by),
  tip: add(limb.tip, by),
  grip: add(limb.grip, by),
});

/** Membre gauche (de face) : celui de droite en miroir. */
function mirror(limb: Limb, from: Pt, to: Pt): Limb {
  const m = (p: Pt): Pt => [to[0] - (p[0] - from[0]), to[1] + (p[1] - from[1])];
  return { root: to, mid: m(limb.mid), end: m(limb.end), tip: m(limb.tip), grip: m(limb.grip) };
}

interface Skeleton {
  t: number;
  hip: Pt;
  neckBase: Pt;
  shoulder: Pt;
  head: Pt;
  /** De profil : bras et jambe du côté visible, et ceux du fond. De face : droite et gauche de l'image. */
  arm: Limb;
  arm2: Limb;
  leg: Limb;
  leg2: Limb;
  /** De face : épaules et hanches, droite puis gauche de l'image. */
  shoulders: [Pt, Pt];
  hips: [Pt, Pt];
}

function solve(pose: Pose, view: ModelDef['view']): Skeleton {
  const d = dir(pose.t);
  if (view === 'side') {
    const neckBase = add(pose.hip, d, L.torso);
    const shoulder = add(neckBase, d, pose.lift ?? 0);
    return {
      t: pose.t,
      hip: pose.hip,
      neckBase,
      shoulder,
      head: add(neckBase, dir(pose.t + (pose.hd ?? 0)), L.neck + L.head),
      arm: solveArm(pose.arm, shoulder, pose.t),
      arm2: shift(solveArm(pose.arm2 ?? pose.arm, shoulder, pose.t), FAR),
      leg: solveLeg(pose.leg, pose.hip, false, 1),
      leg2: shift(solveLeg(pose.leg2 ?? pose.leg, pose.hip, false, 1), FAR),
      shoulders: [shoulder, shoulder],
      hips: [pose.hip, pose.hip],
    };
  }
  const scale = pose.tScale ?? 1;
  const twist = pose.twist ?? 0;
  const neckBase = add(add(pose.hip, d, L.torso * scale), [twist * 8, 0]);
  const across: Pt = [Math.cos(rad(pose.t)), Math.sin(rad(pose.t))];
  const half = 17 * (1 - Math.abs(twist) * 0.3);
  const shoulderR = add(neckBase, across, half);
  const shoulderL = add(neckBase, across, -half);
  const hipR = add(pose.hip, [10, 0]);
  const hipL = add(pose.hip, [-10, 0]);
  const armR = solveArm(pose.arm, shoulderR, 0);
  const legR = solveLeg(pose.leg, hipR, true, 1);
  const legL = pose.leg2 ? solveLeg(pose.leg2, hipL, true, -1) : mirror(legR, hipR, hipL);
  return {
    t: pose.t,
    hip: pose.hip,
    neckBase,
    shoulder: neckBase,
    head: add(add(neckBase, d, (L.neck + L.head) * Math.max(scale, 0.65)), [twist * 4, 0]),
    arm: armR,
    arm2: pose.arm2 ? solveArm(pose.arm2, shoulderL, 0) : mirror(armR, shoulderR, shoulderL),
    leg: legR,
    leg2: legL,
    shoulders: [shoulderR, shoulderL],
    hips: [hipR, hipL],
  };
}

/** Mélange deux positions (nombres, points, objets), champ par champ. */
function mix<T>(a: T, b: T, k: number): T {
  if (typeof a === 'number' && typeof b === 'number') return (a + (b - a) * k) as T;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => mix(v, b[i], k)) as T;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out: Record<string, unknown> = {};
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    for (const key of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
      out[key] = ra[key] === undefined ? rb[key] : rb[key] === undefined ? ra[key] : mix(ra[key], rb[key], k);
    }
    return out as T;
  }
  return k < 0.5 ? a : b;
}

/** Position à un moment du mouvement : 0 = première position, 1 = dernière. */
function poseAt(frames: Pose[], p: number): Pose {
  if (frames.length === 1) return frames[0];
  const x = p * (frames.length - 1);
  const i = Math.min(Math.floor(x), frames.length - 2);
  return mix(frames[i], frames[i + 1], x - i);
}

// ---------- Dessin ----------

const line = (from: Pt, to: Pt, width: number, color: string, opacity = 1, key?: string | number) => (
  <line
    key={key}
    x1={from[0]}
    y1={from[1]}
    x2={to[0]}
    y2={to[1]}
    stroke={color}
    strokeOpacity={opacity}
    strokeWidth={width}
    strokeLinecap="round"
  />
);

/** Moitié d'un segment (avant ou arrière), du point `s1` au point `s2` le long du segment (0 à 1). */
function half(from: Pt, to: Pt, width: number, side: 1 | -1, normal: 'limb' | 'torso', s1 = 0, s2 = 1): [Pt, Pt, number] {
  const u = unit(sub(to, from));
  const n: Pt = normal === 'limb' ? [u[1], -u[0]] : [-u[1], u[0]];
  const offset = (width / 4) * side;
  const a = add(lerp(from, to, s1), n, offset);
  const b = add(lerp(from, to, s2), n, offset);
  return [a, b, width / 2];
}

type Heat = Map<Muscle, number>;

function shapeNode(shape: Shape, index: number) {
  if (shape.kind === 'rect') {
    return (
      <rect
        key={index}
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={shape.r ?? 0}
        fill={COLORS.env}
        stroke={COLORS.envLine}
        strokeWidth={1.5}
      />
    );
  }
  if (shape.kind === 'circle') {
    return <circle key={index} cx={shape.at[0]} cy={shape.at[1]} r={shape.r} fill={COLORS.env} stroke={COLORS.envLine} strokeWidth={1.5} />;
  }
  return line(shape.from, shape.to, shape.w ?? 3, COLORS.envLine, 1, index);
}

function gear(kind: Exclude<Hold, 'auto'>, at: Pt, key: string, dim = false): ReactNode {
  const opacity = dim ? 0.55 : 1;
  switch (kind) {
    case 'barbell':
      return (
        <g key={key} opacity={opacity}>
          <circle cx={at[0]} cy={at[1]} r={13} fill={COLORS.gearFill} stroke={COLORS.gear} strokeWidth={2.5} />
          <circle cx={at[0]} cy={at[1]} r={2.6} fill={COLORS.gear} />
        </g>
      );
    case 'dumbbell':
      return (
        <g key={key} opacity={opacity}>
          <circle cx={at[0]} cy={at[1]} r={6.5} fill={COLORS.gearFill} stroke={COLORS.gear} strokeWidth={2.2} />
          <circle cx={at[0]} cy={at[1]} r={1.8} fill={COLORS.gear} />
        </g>
      );
    case 'plate':
      return (
        <g key={key} opacity={opacity}>
          <circle cx={at[0]} cy={at[1]} r={10} fill={COLORS.gearFill} stroke={COLORS.gear} strokeWidth={2.5} />
          <circle cx={at[0]} cy={at[1]} r={2.4} fill={COLORS.gear} />
        </g>
      );
    case 'wheel':
      return (
        <g key={key} opacity={opacity}>
          <circle cx={at[0]} cy={at[1] + 4} r={8} fill={COLORS.gearFill} stroke={COLORS.gear} strokeWidth={2.5} />
          <circle cx={at[0]} cy={at[1] + 4} r={2} fill={COLORS.gear} />
        </g>
      );
    case 'rope':
      return <circle key={key} cx={at[0]} cy={at[1]} r={3.6} fill="none" stroke={COLORS.gear} strokeWidth={2.4} opacity={opacity} />;
    case 'bar':
    case 'handle':
      return <circle key={key} cx={at[0]} cy={at[1]} r={kind === 'bar' ? 3.2 : 3.6} fill={COLORS.gear} opacity={opacity} />;
    default:
      return null;
  }
}

function resolveHold(hold: Hold | undefined, equipment: Equipment): Exclude<Hold, 'auto'> {
  if (hold && hold !== 'auto') return hold;
  switch (equipment) {
    case 'barre':
    case 'smith':
      return 'barbell';
    case 'halteres':
    case 'kettlebell':
      return 'dumbbell';
    case 'poulie':
    case 'machine':
      return 'handle';
    default:
      return 'none';
  }
}

/** Le mannequin dans une position donnée. */
function Figure({ def, sk, heat, equipment, glowId, ghost = false }: {
  def: ModelDef;
  sk: Skeleton;
  heat: Heat;
  equipment: Equipment;
  glowId: string;
  ghost?: boolean;
}) {
  const hold = resolveHold(def.hold, equipment);
  const showCable = def.cable && (def.forceCable || equipment === 'poulie');
  const hot = (muscle: Muscle) => (ghost ? 0 : (heat.get(muscle) ?? 0));
  const glow = `url(#${glowId})`;
  /** Morceau de muscle allumé, avec un léger halo pour le muscle principal. */
  const lit = (muscle: Muscle, node: (color: string, opacity: number) => ReactNode, key: string) => {
    const level = hot(muscle);
    if (level === 0) return null;
    return (
      <g key={key} filter={level === 1 ? glow : undefined}>
        {node(COLORS.hot, level === 1 ? 0.95 : 0.45)}
      </g>
    );
  };
  const bodyColor = COLORS.body;

  const limbNodes = (limb: Limb, kind: 'arm' | 'leg', color: string, key: string, far: boolean) => {
    const w1 = kind === 'arm' ? W.ua : W.th;
    const w2 = kind === 'arm' ? W.fa : W.sh;
    const wTip = kind === 'arm' ? W.hand : W.foot;
    const heatLevel = far ? 0.6 : 1;
    const nodes: ReactNode[] = [
      line(limb.mid, limb.end, w2, color, 1, `${key}-2`),
      line(limb.end, limb.tip, wTip, color, 1, `${key}-3`),
      line(limb.root, limb.mid, w1, color, 1, `${key}-1`),
    ];
    const seg = (muscle: Muscle, from: Pt, to: Pt, width: number, side: 0 | 1 | -1, s1 = 0, s2 = 1, normal: 'limb' | 'torso' = 'limb') =>
      lit(
        muscle,
        (c, o) => {
          if (side === 0) return line(lerp(from, to, s1), lerp(from, to, s2), width * 0.82, c, o * heatLevel);
          const [a, b, w] = half(from, to, width, side, normal, s1, s2);
          return line(a, b, w, c, o * heatLevel);
        },
        `${key}-${muscle}-${s1}`,
      );
    if (def.view === 'side') {
      if (kind === 'arm') {
        nodes.push(seg('biceps', limb.root, limb.mid, w1, 1, 0.15, 0.95));
        nodes.push(seg('triceps', limb.root, limb.mid, w1, -1, 0.1, 0.95));
        nodes.push(seg('avant-bras', limb.mid, limb.end, w2, 0, 0.1, 0.9));
      } else {
        nodes.push(seg('quadriceps', limb.root, limb.mid, w1, 1, 0.12, 0.92));
        nodes.push(seg('ischios', limb.root, limb.mid, w1, -1, 0.15, 0.95));
        nodes.push(seg('adducteurs', limb.root, limb.mid, 5, 0, 0.1, 0.7));
        nodes.push(seg('abducteurs', limb.root, limb.mid, 5, 0, 0, 0.35));
        nodes.push(seg('mollets', limb.mid, limb.end, w2, -1, 0.12, 0.7));
      }
    } else {
      // De face ou de dos : l'extérieur du membre est du côté de son épaule ou de sa hanche.
      const outward: 1 | -1 = limb.root[0] >= sk.hip[0] ? 1 : -1;
      const back = def.view === 'back';
      if (kind === 'arm') {
        nodes.push(seg(back ? 'triceps' : 'biceps', limb.root, limb.mid, w1, 0, 0.12, 0.92));
        nodes.push(seg('avant-bras', limb.mid, limb.end, w2, 0, 0.1, 0.9));
      } else {
        nodes.push(seg(back ? 'ischios' : 'quadriceps', limb.root, limb.mid, w1, 0, 0.1, 0.92));
        const inner = (-outward * (limb.mid[1] >= limb.root[1] ? 1 : -1)) as 1 | -1;
        nodes.push(seg('adducteurs', limb.root, limb.mid, w1, inner, 0.1, 0.85));
        nodes.push(seg('abducteurs', limb.root, limb.mid, w1, (-inner) as 1 | -1, 0, 0.55));
        nodes.push(seg('mollets', limb.mid, limb.end, w2, back ? 0 : ((-inner) as 1 | -1), 0.1, 0.7));
      }
    }
    return nodes;
  };

  const cableTo = (index: number): Pt => {
    const limb = index === 0 ? (def.cableTo === 'ankle' ? sk.leg : sk.arm) : def.cableTo === 'ankle' ? sk.leg2 : sk.arm2;
    return def.cableTo === 'ankle' ? limb.end : limb.grip;
  };

  const d = dir(sk.t);
  const n: Pt = [-d[1], d[0]]; // avant du buste
  const back: Pt = [-n[0], -n[1]];

  // Charge posée sur le corps.
  const loadAt: Pt | null =
    def.load === 'back-bar'
      ? add(add(sk.neckBase, back, 8), d, -2)
      : def.load === 'front-bar'
        ? add(add(sk.neckBase, n, 9), d, -3)
        : def.load === 'hip-bar'
          ? add(sk.hip, n, 12)
          : null;

  const padNodes = (def.pads ?? []).map((pad, index) => {
    const r = pad.r ?? 5.5;
    const fill = { fill: COLORS.env, stroke: COLORS.envLine, strokeWidth: 1.5 };
    if (pad.joint === 'forearm') {
      return (
        <g key={`pad-${index}`}>
          {line(sk.arm.mid, sk.arm.end, 11, 'rgb(255 255 255 / 0.16)')}
          {line(sk.arm2.mid, sk.arm2.end, 11, 'rgb(255 255 255 / 0.16)')}
        </g>
      );
    }
    if (pad.joint === 'shoulder') {
      const at = add(sk.shoulder, d, 6);
      return <circle key={`pad-${index}`} cx={at[0]} cy={at[1]} r={r + 0.5} {...fill} />;
    }
    if (def.view !== 'side' && (pad.side === 'out' || pad.side === 'in')) {
      return (
        <g key={`pad-${index}`}>
          {[sk.leg, sk.leg2].map((leg, i) => {
            const outward = leg.root[0] >= sk.hip[0] ? 1 : -1;
            const at = add(leg.mid, [outward * (pad.side === 'out' ? 8 : -8), 0]);
            return <circle key={i} cx={at[0]} cy={at[1]} r={r} {...fill} />;
          })}
        </g>
      );
    }
    const limb = sk.leg;
    const from = pad.joint === 'ankle' ? limb.mid : limb.root;
    const to = pad.joint === 'ankle' ? limb.end : limb.mid;
    const u = unit(sub(to, from));
    const ln: Pt = [u[1], -u[0]];
    const sign = pad.side === 'back' ? -1 : 1;
    const base = pad.joint === 'ankle' ? add(limb.end, u, -4) : limb.mid;
    const at = add(base, ln, sign * (pad.joint === 'knee' ? 9 : 7.5));
    return <circle key={`pad-${index}`} cx={at[0]} cy={at[1]} r={r} {...fill} />;
  });

  const footPlate = (() => {
    if (!def.footPlate) return null;
    const leg = sk.leg;
    const u = unit(sub(leg.tip, leg.end));
    const sole: Pt = [u[1], -u[0]];
    const a = add(add(leg.end, u, -8), sole, -4);
    const b = add(add(leg.tip, u, 9), sole, -4);
    return line(a, b, 4, COLORS.gear, 0.8, 'plate');
  })();

  const backPad = def.backPad ? line(add(add(sk.hip, back, 11), d, -10), add(add(sk.hip, back, 11), d, 52), 7, 'rgb(255 255 255 / 0.14)', 1, 'backpad') : null;

  if (def.view === 'side') {
    const torsoTop = sk.neckBase;
    const torsoParts = [
      lit('pectoraux', (c, o) => { const [a, b, w] = half(torsoTop, sk.hip, W.torso, 1, 'torso', 0.1, 0.48); return line(a, b, w, c, o); }, 'pecs'),
      lit('abdominaux', (c, o) => { const [a, b, w] = half(torsoTop, sk.hip, W.torso, 1, 'torso', 0.52, 0.92); return line(a, b, w, c, o); }, 'abs'),
      lit('dos', (c, o) => { const [a, b, w] = half(torsoTop, sk.hip, W.torso, -1, 'torso', 0.12, 0.6); return line(a, b, w, c, o); }, 'back'),
      lit('lombaires', (c, o) => { const [a, b, w] = half(torsoTop, sk.hip, W.torso, -1, 'torso', 0.64, 0.94); return line(a, b, w, c, o); }, 'lower'),
      lit('trapezes', (c, o) => line(add(sk.shoulder, back, 3), add(add(torsoTop, d, L.neck + 1), back, 1.5), 5.5, c, o), 'traps'),
      lit('fessiers', (c, o) => { const at = add(sk.hip, back, 4); return <circle cx={at[0]} cy={at[1]} r={7.5} fill={c} fillOpacity={o} />; }, 'glutes'),
    ];
    const plateBehindArm = hold === 'barbell' || hold === 'plate' || hold === 'wheel';
    const shoulderLit = lit('epaules', (c, o) => <circle cx={sk.shoulder[0]} cy={sk.shoulder[1]} r={6.5} fill={c} fillOpacity={o} />, 'delts');
    return (
      <g opacity={ghost ? 0.22 : 1}>
        {showCable &&
          def.cable!.slice(0, 1).map((anchor, i) => (
            <g key={`cable-${i}`}>{line(anchor, cableTo(i), 1.3, COLORS.cable)}</g>
          ))}
        {limbNodes(sk.leg2, 'leg', COLORS.far, 'leg2', true)}
        {limbNodes(sk.arm2, 'arm', COLORS.far, 'arm2', true)}
        {def.holdBoth && hold !== 'barbell' && gear(hold, sk.arm2.grip, 'gear2', true)}
        {backPad}
        {line(sk.hip, torsoTop, W.torso, bodyColor)}
        {line(torsoTop, add(torsoTop, dir(sk.t), L.neck + 1), W.neck, bodyColor)}
        <circle cx={sk.head[0]} cy={sk.head[1]} r={L.head} fill={bodyColor} />
        {torsoParts}
        {limbNodes(sk.leg, 'leg', bodyColor, 'leg', false)}
        {padNodes}
        {footPlate}
        {loadAt && gear('barbell', loadAt, 'load')}
        {plateBehindArm && gear(hold, sk.arm.grip, 'gear')}
        {limbNodes(sk.arm, 'arm', bodyColor, 'arm', false)}
        {shoulderLit}
        {!plateBehindArm && gear(hold, sk.arm.grip, 'gear')}
      </g>
    );
  }

  // ----- De face ou de dos -----
  const [sR, sL] = sk.shoulders;
  const [hR, hL] = sk.hips;
  const center = (s: number) => lerp(sk.neckBase, sk.hip, s);
  const edge = (side: 'R' | 'L', s: number) => (side === 'R' ? lerp(sR, hR, s) : lerp(sL, hL, s));
  const poly = (points: Pt[], c: string, o: number) => (
    <polygon points={points.map((p) => p.join(',')).join(' ')} fill={c} fillOpacity={o} stroke={c} strokeOpacity={o} strokeWidth={2} strokeLinejoin="round" />
  );
  const isBack = def.view === 'back';
  const torsoParts = isBack
    ? [
        lit('trapezes', (c, o) => poly([add(sk.neckBase, [-5, -3]), add(sk.neckBase, [5, -3]), lerp(sk.neckBase, sR, 0.85), center(0.34), lerp(sk.neckBase, sL, 0.85)], c, o), 'traps'),
        lit('dos', (c, o) => poly([add(lerp(sL, sR, 0.1), [0, 5]), add(lerp(sL, sR, 0.9), [0, 5]), add(edge('R', 0.55), [-2, 0]), add(center(0.74), [5, 0]), add(center(0.74), [-5, 0]), add(edge('L', 0.55), [2, 0])], c, o), 'back'),
        lit('lombaires', (c, o) => poly([add(center(0.74), [-6, 0]), add(center(0.74), [6, 0]), add(center(0.95), [6, 0]), add(center(0.95), [-6, 0])], c, o), 'lower'),
        lit('fessiers', (c, o) => (
          <g>
            <circle cx={hR[0]} cy={hR[1] + 5} r={8.5} fill={c} fillOpacity={o} />
            <circle cx={hL[0]} cy={hL[1] + 5} r={8.5} fill={c} fillOpacity={o} />
          </g>
        ), 'glutes'),
      ]
    : [
        lit('trapezes', (c, o) => (
          <g>
            {line(add(sk.neckBase, [3, -1]), lerp(sk.neckBase, sR, 0.75), 4.5, c, o)}
            {line(add(sk.neckBase, [-3, -1]), lerp(sk.neckBase, sL, 0.75), 4.5, c, o)}
          </g>
        ), 'traps'),
        lit('pectoraux', (c, o) => (
          <g>
            {poly([add(center(0.08), [1.5, 0]), lerp(center(0.06), sR, 0.85), edge('R', 0.36), add(center(0.42), [1.5, 0])], c, o)}
            {poly([add(center(0.08), [-1.5, 0]), lerp(center(0.06), sL, 0.85), edge('L', 0.36), add(center(0.42), [-1.5, 0])], c, o)}
          </g>
        ), 'pecs'),
        lit('abdominaux', (c, o) => poly([add(center(0.46), [-6.5, 0]), add(center(0.46), [6.5, 0]), add(center(0.93), [5, 0]), add(center(0.93), [-5, 0])], c, o), 'abs'),
        lit('dos', (c, o) => (
          <g>
            {poly([edge('R', 0.18), edge('R', 0.6), lerp(edge('R', 0.6), center(0.6), 0.22), lerp(edge('R', 0.18), center(0.18), 0.12)], c, o)}
            {poly([edge('L', 0.18), edge('L', 0.6), lerp(edge('L', 0.6), center(0.6), 0.22), lerp(edge('L', 0.18), center(0.18), 0.12)], c, o)}
          </g>
        ), 'lats'),
      ];
  const handGear = hold === 'plate'
    ? gear('plate', lerp(sk.arm.grip, sk.arm2.grip, 0.5), 'plate')
    : [gear(hold, sk.arm.grip, 'gearR'), gear(hold, sk.arm2.grip, 'gearL')];

  return (
    <g opacity={ghost ? 0.22 : 1}>
      {showCable &&
        def.cable!.map((anchor, i) => <g key={`cable-${i}`}>{line(anchor, cableTo(i), 1.3, COLORS.cable)}</g>)}
      {limbNodes(sk.leg, 'leg', bodyColor, 'legR', false)}
      {limbNodes(sk.leg2, 'leg', bodyColor, 'legL', false)}
      <polygon
        points={[sL, sR, add(hR, [1, 0]), add(hL, [-1, 0])].map((p) => p.join(',')).join(' ')}
        fill={bodyColor}
        stroke={bodyColor}
        strokeWidth={7}
        strokeLinejoin="round"
      />
      {line(sk.neckBase, add(sk.neckBase, dir(sk.t), L.neck + 1), W.neck, bodyColor)}
      <circle cx={sk.head[0]} cy={sk.head[1]} r={L.head} fill={bodyColor} />
      {torsoParts}
      {padNodes}
      {limbNodes(sk.arm, 'arm', bodyColor, 'armR', false)}
      {limbNodes(sk.arm2, 'arm', bodyColor, 'armL', false)}
      {lit('epaules', (c, o) => (
        <g>
          <circle cx={sR[0]} cy={sR[1]} r={6.5} fill={c} fillOpacity={o} />
          <circle cx={sL[0]} cy={sL[1]} r={6.5} fill={c} fillOpacity={o} />
        </g>
      ), 'delts')}
      {handGear}
    </g>
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    document.documentElement.dataset.motion === 'reduced' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Mannequin animé d'un exercice. Un appui met en pause (ou relance).
 * « Réduire les animations » : les deux positions sont montrées l'une sur l'autre, sans mouvement.
 */
export function ExerciseModel({
  model,
  equipment,
  primary,
  secondary,
  label,
  at,
}: {
  model: ModelId | null;
  equipment: Equipment;
  primary: Muscle;
  secondary: Muscle[];
  label: string;
  /** Image fixe à ce moment du mouvement (0 = départ, 1 = arrivée), sans animation. */
  at?: number;
}) {
  const glowId = `glow-${useId().replace(/:/g, '')}`;
  const svg = useRef<SVGSVGElement>(null);
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  // Sans mouvement connu (exercice personnel) : le mannequin debout, muscles allumés.
  const def: ModelDef = (model && MODELS[model]) || { view: 'front', hold: 'none', frames: [{ hip: [120, 87], t: 0, leg: { th: 178, sh: 180 }, arm: { ua: 172, fa: 176 } }] };
  const animated = def.frames.length > 1 && !reduced && at === undefined;

  useEffect(() => {
    if (!animated || paused) return;
    let raf = 0;
    let last = 0;
    let visible = true;
    const startAt = performance.now() - phase * PERIOD_MS;
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
          })
        : null;
    if (svg.current && observer) observer.observe(svg.current);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Environ 30 images par seconde, et rien quand le dessin n'est pas à l'écran.
      if (!visible || document.hidden || now - last < 32) return;
      last = now;
      setPhase(((now - startAt) % PERIOD_MS) / PERIOD_MS);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
    // `phase` sert seulement à repartir d'où on s'était arrêté.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, paused, model]);

  const heat: Heat = new Map(secondary.map((m) => [m, 0.5]));
  heat.set(primary, 1);
  const progress = at ?? (animated ? (1 - Math.cos(2 * Math.PI * phase)) / 2 : 1);
  const sk = solve(poseAt(def.frames, progress), def.view);
  const ground = def.ground !== false;

  return (
    <svg
      ref={svg}
      viewBox="0 -16 240 190"
      role="img"
      aria-label={label}
      onClick={() => animated && setPaused((p) => !p)}
      className="block h-auto w-full select-none"
    >
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {ground && (
        <>
          <ellipse cx={sk.hip[0]} cy={169} rx={46} ry={4} fill="rgb(0 0 0 / 0.28)" />
          <line x1={8} y1={168} x2={232} y2={168} stroke={COLORS.envLine} strokeWidth={2} strokeLinecap="round" />
        </>
      )}
      {(def.env ?? []).map(shapeNode)}
      {/* Sans animation : la position de départ en transparence, sous la position d'arrivée. */}
      {!animated && at === undefined && def.frames.length > 1 && (
        <Figure def={def} sk={solve(def.frames[0], def.view)} heat={heat} equipment={equipment} glowId={glowId} ghost />
      )}
      <Figure def={def} sk={sk} heat={heat} equipment={equipment} glowId={glowId} />
      {paused && (
        <g opacity={0.8}>
          <rect x={214} y={-10} width={4} height={14} rx={1.5} fill={COLORS.gear} />
          <rect x={222} y={-10} width={4} height={14} rx={1.5} fill={COLORS.gear} />
        </g>
      )}
    </svg>
  );
}
