import { useEffect, useRef, useState } from 'react';
import { ANIMATED_PRESETS, type BackgroundSettings, type Effects, type MotionChoice } from '../data';
import { onAmbient } from './ambient';
import { PatternBackground } from './PatternBackground';
import { fallbackColors, flatBackground } from './theme';

/*
 * Fond de l'appli. Par défaut, « forge liquide » : dessiné en continu par la carte graphique (WebGL).
 * Personnalisable (V2) : autre ambiance animée (mêmes formes, autres couleurs), vitesse, luminosité,
 * couleur unie, dégradé ou photo de l'utilisateur.
 *
 * Monté une seule fois, à la racine de l'appli : changer d'écran ou de thème ne le réinitialise pas.
 * Le temps avance sans jamais revenir à zéro : ni boucle visible, ni retour brutal.
 *
 * Couches du fond animé, de la plus profonde à la plus proche, chacune sur son propre rythme :
 *  1. métal en fusion : matière liquide qui se replie sur elle-même en permanence ;
 *  2. cinq teintes du thème qui glissent les unes dans les autres ;
 *  3. grandes formes floues qui dérivent, gonflent et dégonflent ;
 *  4. voiles lumineux, comme une aurore, qui ondulent dans le haut ;
 *  5. reflets de lumière réfractée sur le liquide ;
 *
 * Il réagit aussi à l'appli (chaque réaction peut être coupée dans la personnalisation) :
 *  - un appui n'importe où fait naître une onde ;
 *  - un record battu déclenche une onde de choc dorée ;
 *  - pendant le repos, tout ralentit et le fond respire (6 respirations par minute),
 *    puis une vague marque la fin du repos.
 * Sur un fond uni, un dégradé ou une photo, ces réactions sont rendues par de simples cercles en CSS.
 */


const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;    // temps du liquide (ralentit pendant le repos)
uniform float uClock;   // temps réel, en secondes
uniform vec3 uRipples[4]; // appuis : position x, y, instant
uniform vec3 uBurst;    // onde de choc : instant, force, teinte (0 = rouge, 1 = or)
uniform float uCalm;    // 0 = normal, 1 = repos
uniform vec3 uPal[5];     // cinq teintes portées par le liquide
uniform vec3 uCurtain[2]; // voiles lumineux
uniform vec3 uGlint;      // reflets
uniform vec3 uRippleColor;
uniform vec3 uWave;       // vague de fin de repos
uniform vec3 uShade;      // bords assombris
uniform float uGain;      // luminosité

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// Teinte continue entre les cinq couleurs du thème : leur poids tourne doucement, sans aucun saut.
vec3 ember(float x, float t) {
  float a = x * 6.2831 + t;
  float w0 = pow(0.5 + 0.5 * sin(a), 3.0);
  float w1 = pow(0.5 + 0.5 * sin(a + 1.2566), 3.0);
  float w2 = pow(0.5 + 0.5 * sin(a + 2.5133), 3.0);
  float w3 = pow(0.5 + 0.5 * sin(a + 3.7699), 3.0) * 0.55; // le feu reste un éclat, pas un fond
  float w4 = pow(0.5 + 0.5 * sin(a + 5.0265), 3.0) * 0.7;
  return (uPal[0] * w0 + uPal[1] * w1 + uPal[2] * w2 + uPal[3] * w3 + uPal[4] * w4) / (w0 + w1 + w2 + w3 + w4);
}

float blob(vec2 p, vec2 freq, vec2 phase, float t, float radius) {
  vec2 c = 0.55 * vec2(sin(t * freq.x + phase.x), cos(t * freq.y + phase.y));
  float r = radius * (0.75 + 0.25 * sin(t * (freq.x + freq.y) * 0.7 + phase.x));
  float d = length(p - c) + 0.18 * (fbm(p * 2.0 + t * 0.05 + phase) - 0.5);
  return exp(-d * d / (r * r));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime;
  float now = uClock;

  // Ondes des appuis : elles déforment le liquide en s'éloignant du doigt.
  float rings = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 rp = uRipples[i];
    float age = now - rp.z;
    if (age > 0.0 && age < 3.5) {
      vec2 d = p - rp.xy;
      float dist = length(d);
      float front = dist - age * 0.5;
      float wave = sin(front * 30.0) * exp(-front * front * 30.0) * exp(-age * 1.1);
      p += normalize(d + 1e-4) * wave * 0.06;
      rings += wave;
    }
  }

  // Onde de choc d'un record, partie du centre.
  float burstAge = now - uBurst.x;
  float shock = 0.0;
  if (burstAge > 0.0 && burstAge < 4.0) {
    float front = length(p) - burstAge * 0.75;
    shock = exp(-front * front * 18.0) * exp(-burstAge * 0.9) * uBurst.y;
    p *= 1.0 - shock * 0.04;
  }

  // 1. Métal en fusion.
  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t * 0.031)),
                fbm(p * 1.1 + vec2(5.2, 1.3) - t * 0.023));
  vec2 r = vec2(fbm(p * 1.4 + 2.2 * q + vec2(1.7, 9.2) + t * 0.041),
                fbm(p * 1.4 + 2.2 * q + vec2(8.3, 2.8) - t * 0.037));
  float f = fbm(p * 1.2 + 2.6 * r + t * 0.012);

  // 2. Rouges portés par le liquide.
  vec3 col = ember(f + 0.35 * length(q) + 0.15 * r.x, t * 0.045);
  col *= 0.22 + 1.0 * f * f;

  // 3. Grandes formes floues.
  col += ember(0.00, t * 0.031) * 0.60 * blob(p, vec2(0.071, 0.053), vec2(0.0, 1.3), t, 0.55);
  col += ember(0.27, t * 0.027) * 0.55 * blob(p, vec2(0.043, 0.067), vec2(2.1, 0.4), t, 0.50);
  col += ember(0.55, t * 0.038) * 0.45 * blob(p, vec2(0.059, 0.037), vec2(4.2, 3.3), t, 0.45);
  col += ember(0.80, t * 0.022) * 0.40 * blob(p, vec2(0.033, 0.049), vec2(1.1, 5.0), t, 0.60);

  // 4. Voiles de chaleur.
  float wave = p.y - 0.30 - 0.22 * sin(p.x * 1.7 + t * 0.11) - 0.18 * (fbm(vec2(p.x * 1.8, t * 0.06)) - 0.5);
  float curtain = exp(-wave * wave * 9.0) * (0.55 + 0.45 * sin(p.x * 9.0 + t * 0.35 + 5.0 * fbm(p * 2.5 + t * 0.03)));
  col += mix(uCurtain[0], uCurtain[1], 0.5 + 0.5 * sin(p.x * 1.3 + t * 0.07)) * curtain * 0.26;

  // 5. Reflets réfractés.
  float caustic = pow(abs(sin(f * 17.0 + r.y * 6.0 - t * 0.42)), 18.0);
  col += uGlint * caustic * 0.15 * smoothstep(0.35, 0.7, f);

  // Réactions : ondes des appuis, onde de choc, respiration du repos.
  col += uRippleColor * abs(rings) * 0.45;
  vec3 shockColor = mix(uWave, vec3(1.0, 0.78, 0.30), uBurst.z);
  col += shockColor * shock * 0.9;
  col += shockColor * exp(-max(burstAge, 0.0) * 2.2) * step(0.0, burstAge) * uBurst.y * 0.12;
  float breath = 0.5 + 0.5 * sin(now * 6.2831 / 10.0);
  col *= 1.0 + uCalm * (breath - 0.5) * 0.7;

  col *= uGain;

  // Assombrir les bords pour que le texte reste lisible.
  float vignette = smoothstep(1.35, 0.2, length(p));
  col = mix(uShade, col, 0.66 * vignette + 0.08);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Résolution de calcul, relative à la taille affichée : le fond est flou, inutile de calculer chaque pixel. */
const RENDER_SCALE = 0.45;
const MAX_RIPPLES = 4;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Fond animé :', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Téléphone ou tablette : on calcule moins d'images par seconde pour ménager la batterie. */
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

export interface AmbientConfig {
  /** null tant que la personnalisation n'est pas lue : rien n'est dessiné (pas d'éclair d'un autre thème). */
  background: BackgroundSettings | null;
  /** Photo affichée quand le fond est une photo. */
  imageUrl: string | null;
  motion: MotionChoice;
  effects: Effects;
}

/** Ce que le reste du composant demande au dessin WebGL. */
interface GlControl {
  /** Relit la configuration (couleurs, vitesse…) et relance ou arrête le dessin. */
  refresh: () => void;
  ripple: (clientX: number, clientY: number) => void;
  burst: (strength: number, hue: number) => void;
  rest: (endsAt: number | null) => void;
}

const reducedMotion = (config: AmbientConfig, query: MediaQueryList) =>
  config.motion === 'reduced' || (config.motion === 'auto' && query.matches);

export function LiquidBackground({ config }: { config: AmbientConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const glRef = useRef<GlControl | null>(null);
  const [fallback, setFallback] = useState(false);

  // Dessin WebGL : créé une seule fois.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      setFallback(true);
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      setFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFallback(true);
      return;
    }
    gl.useProgram(program);

    // Un seul grand triangle qui couvre tout l'écran.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      res: uniform('uRes'),
      time: uniform('uTime'),
      clock: uniform('uClock'),
      ripples: uniform('uRipples'),
      burst: uniform('uBurst'),
      calm: uniform('uCalm'),
      pal: uniform('uPal'),
      curtain: uniform('uCurtain'),
      glint: uniform('uGlint'),
      rippleColor: uniform('uRippleColor'),
      wave: uniform('uWave'),
      shade: uniform('uShade'),
      gain: uniform('uGain'),
    };

    const startedAt = performance.now();
    const clock = (now: number) => (now - startedAt) / 1000;
    // Le liquide part d'un instant différent à chaque ouverture : jamais deux fois le même fond.
    let flow = Math.random() * 600;
    let speed = 1;
    let calm = 0;
    let restEndsAt: number | null = null;
    let lastNow = performance.now();
    const ripples = new Float32Array(MAX_RIPPLES * 3).fill(-100);
    let nextRipple = 0;
    const burst = new Float32Array([-100, 0, 0]);

    const frameMs = isTouchDevice() ? 1000 / 30 : 1000 / 60;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let lastFrame = 0;

    const settings = () => configRef.current;
    const active = () => settings().background?.kind === 'animated';
    const reduced = () => reducedMotion(settings(), motionQuery);

    /** Couleurs et luminosité de l'ambiance choisie. */
    const applyColors = () => {
      const background = settings().background;
      const preset = ANIMATED_PRESETS[background?.preset ?? 'forge'];
      gl.uniform3fv(u.pal, preset.palette.flat());
      gl.uniform3fv(u.curtain, preset.curtain.flat());
      gl.uniform3fv(u.glint, preset.glint);
      gl.uniform3fv(u.rippleColor, preset.ripple);
      gl.uniform3fv(u.wave, preset.wave);
      gl.uniform3fv(u.shade, preset.shade);
      gl.uniform1f(u.gain, background?.intensity ?? 1);
    };

    const resize = () => {
      const width = Math.max(1, Math.round(window.innerWidth * RENDER_SCALE));
      const height = Math.max(1, Math.round(window.innerHeight * RENDER_SCALE));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(u.res, width, height);
    };

    const draw = (now: number) => {
      // Avance du liquide : ralentit en douceur pendant le repos, sans jamais revenir en arrière.
      const dt = Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;
      const { effects, background } = settings();
      if (restEndsAt !== null && Date.now() >= restEndsAt) {
        // Fin du repos : une vague part du centre.
        restEndsAt = null;
        if (effects.restBreath) burst.set([clock(now), 0.8, 0]);
      }
      const resting = effects.restBreath && restEndsAt !== null;
      const ease = Math.min(1, dt * 1.2);
      calm += ((resting ? 1 : 0) - calm) * ease;
      speed += ((resting ? 0.35 : 1) - speed) * ease;
      flow += dt * speed * (background?.speed ?? 1);

      gl.uniform1f(u.time, flow);
      gl.uniform1f(u.clock, clock(now));
      gl.uniform3fv(u.ripples, ripples);
      gl.uniform3fv(u.burst, burst);
      gl.uniform1f(u.calm, calm);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastFrame < frameMs - 1) return;
      lastFrame = now;
      draw(now);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      // Fond uni, dégradé ou photo : la carte graphique se repose.
      if (!active()) return;
      resize();
      lastNow = performance.now();
      if (reduced()) draw(performance.now()); // mouvement réduit demandé : image fixe
      else if (document.visibilityState === 'visible') raf = requestAnimationFrame(loop);
    };

    glRef.current = {
      refresh: () => {
        applyColors();
        start();
      },
      ripple: (clientX, clientY) => {
        const scale = Math.min(window.innerWidth, window.innerHeight);
        const x = (clientX - window.innerWidth / 2) / scale;
        const y = (window.innerHeight / 2 - clientY) / scale;
        ripples.set([x, y, clock(performance.now())], nextRipple * 3);
        nextRipple = (nextRipple + 1) % MAX_RIPPLES;
      },
      burst: (strength, hue) => burst.set([clock(performance.now()), strength, hue]),
      rest: (endsAt) => {
        restEndsAt = endsAt;
      },
    };

    const onVisibility = () => {
      // Appli en arrière-plan : on arrête de calculer, la batterie dit merci.
      if (document.visibilityState === 'visible') start();
      else cancelAnimationFrame(raf);
    };
    const onResize = () => {
      if (!active()) return;
      resize();
      if (reduced()) draw(performance.now());
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      glRef.current = null;
      setFallback(true);
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', start);
    canvas.addEventListener('webglcontextlost', onLost);
    applyColors();
    start();

    return () => {
      cancelAnimationFrame(raf);
      glRef.current = null;
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', start);
      canvas.removeEventListener('webglcontextlost', onLost);
    };
  }, []);

  // Nouvelle configuration (autre thème, vitesse…) : le dessin suit, sans repartir de zéro.
  const key = JSON.stringify([config.background, config.motion]);
  useEffect(() => {
    glRef.current?.refresh();
  }, [key]);

  // Réactions : onde sous le doigt, onde de choc d'un record, respiration du repos.
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settings = () => configRef.current;
    const drawnByGl = () => settings().background?.kind === 'animated' && glRef.current !== null;
    let restTimer = 0;

    /** Cercle qui s'agrandit et s'efface (fonds sans carte graphique). */
    const ring = (x: number, y: number, className: string) => {
      const layer = fxRef.current;
      if (!layer) return;
      const span = document.createElement('span');
      span.className = className;
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      span.addEventListener('animationend', () => span.remove());
      layer.appendChild(span);
    };

    const onPointer = (event: PointerEvent) => {
      const config = settings();
      if (!config.background || !config.effects.ripples || reducedMotion(config, motionQuery)) return;
      if (drawnByGl()) glRef.current!.ripple(event.clientX, event.clientY);
      else ring(event.clientX, event.clientY, 'ambient-ring');
    };

    const stop = onAmbient((event) => {
      const config = settings();
      if (event.kind === 'record') {
        if (!config.effects.recordWave || reducedMotion(config, motionQuery)) return;
        if (drawnByGl()) glRef.current!.burst(1.2, 1);
        else ring(window.innerWidth / 2, window.innerHeight / 2, 'ambient-ring ambient-ring-gold');
        return;
      }
      glRef.current?.rest(event.endsAt);
      // Fonds sans carte graphique : le fond s'assombrit doucement en rythme, puis un cercle à la fin.
      window.clearTimeout(restTimer);
      const layer = fxRef.current;
      const breathe = event.endsAt !== null && config.effects.restBreath && !reducedMotion(config, motionQuery);
      layer?.classList.toggle('ambient-breathe', breathe && !drawnByGl());
      if (breathe && event.endsAt !== null) {
        restTimer = window.setTimeout(
          () => {
            layer?.classList.remove('ambient-breathe');
            if (!drawnByGl()) ring(window.innerWidth / 2, window.innerHeight / 2, 'ambient-ring ambient-ring-wide');
          },
          Math.max(0, event.endsAt - Date.now()),
        );
      }
    });

    window.addEventListener('pointerdown', onPointer, { passive: true });
    return () => {
      stop();
      window.clearTimeout(restTimer);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  const background = config.background;
  const kind = background?.kind ?? null;
  const preset = ANIMATED_PRESETS[background?.preset ?? 'forge'];
  const colors = fallbackColors(preset);

  // z-index négatif : le fond reste SOUS tout le contenu de la page. Avec z-0, il passait
  // devant tout ce qui n'est pas une carte en verre (bouton « Ajouter un exercice »,
  // séance libre vide…), qui devenait invisible.
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {fallback ? (
        kind === 'animated' && (
          <div className="ambient-fallback" style={{ background: colors[0] }}>
            {colors.slice(1).map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </div>
        )
      ) : (
        <canvas
          ref={canvasRef}
          className="block h-full w-full transition-opacity duration-700"
          style={{ opacity: kind === 'animated' ? 1 : 0 }}
        />
      )}

      {background && kind === 'pattern' && (
        <PatternBackground
          background={background}
          still={reducedMotion(config, window.matchMedia('(prefers-reduced-motion: reduce)'))}
        />
      )}

      {background && (kind === 'solid' || kind === 'gradient') && (
        <div className="absolute inset-0" style={{ background: flatBackground(background) }} />
      )}

      {background && kind === 'image' && config.imageUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url("${config.imageUrl}")`,
              filter: background.imageBlur > 0 ? `blur(${background.imageBlur}px)` : undefined,
              // Le flou ronge les bords : on agrandit un peu l'image pour ne pas les voir.
              transform: background.imageBlur > 0 ? 'scale(1.08)' : undefined,
            }}
          />
          <div className="absolute inset-0" style={{ background: `rgb(0 0 0 / ${background.imageDim})` }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(0_0_0/0.35))]" />
        </>
      )}

      <div ref={fxRef} className="absolute inset-0" />
    </div>
  );
}
