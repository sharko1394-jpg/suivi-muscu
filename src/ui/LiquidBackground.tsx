import { useEffect, useRef, useState } from 'react';
import { onAmbient } from './ambient';

/*
 * Fond animé « forge liquide », dessiné en continu par la carte graphique (WebGL).
 *
 * Monté une seule fois, à la racine de l'appli : changer d'écran ne le réinitialise pas.
 * Le temps avance sans jamais revenir à zéro : ni boucle visible, ni retour brutal.
 *
 * Couches, de la plus profonde à la plus proche, chacune sur son propre rythme :
 *  1. métal en fusion : matière liquide qui se replie sur elle-même en permanence ;
 *  2. teintes rouges (grenat, carmin, sang, braise, rose) qui glissent les unes dans les autres ;
 *  3. grandes formes floues qui dérivent, gonflent et dégonflent ;
 *  4. voiles de chaleur, comme une aurore rouge, qui ondulent dans le haut ;
 *  5. reflets de lumière réfractée sur le liquide ;
 *  6. braises qui montent doucement du bas de l'écran.
 *
 * Il réagit aussi à l'appli :
 *  - un appui n'importe où fait naître une onde dans le liquide ;
 *  - un record battu déclenche une onde de choc dorée ;
 *  - pendant le repos, tout ralentit et le fond respire (6 respirations par minute),
 *    puis une vague rouge marque la fin du repos.
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

// Teinte continue entre cinq rouges : leur poids tourne doucement, sans aucun saut.
vec3 ember(float x, float t) {
  vec3 garnet  = vec3(0.30, 0.02, 0.08);
  vec3 carmine = vec3(0.80, 0.06, 0.12);
  vec3 blood   = vec3(0.52, 0.01, 0.03);
  vec3 fire    = vec3(0.98, 0.34, 0.08);
  vec3 rose    = vec3(0.78, 0.10, 0.38);
  float a = x * 6.2831 + t;
  float w0 = pow(0.5 + 0.5 * sin(a), 3.0);
  float w1 = pow(0.5 + 0.5 * sin(a + 1.2566), 3.0);
  float w2 = pow(0.5 + 0.5 * sin(a + 2.5133), 3.0);
  float w3 = pow(0.5 + 0.5 * sin(a + 3.7699), 3.0) * 0.55; // le feu reste un éclat, pas un fond
  float w4 = pow(0.5 + 0.5 * sin(a + 5.0265), 3.0) * 0.7;
  return (garnet * w0 + carmine * w1 + blood * w2 + fire * w3 + rose * w4) / (w0 + w1 + w2 + w3 + w4);
}

float blob(vec2 p, vec2 freq, vec2 phase, float t, float radius) {
  vec2 c = 0.55 * vec2(sin(t * freq.x + phase.x), cos(t * freq.y + phase.y));
  float r = radius * (0.75 + 0.25 * sin(t * (freq.x + freq.y) * 0.7 + phase.x));
  float d = length(p - c) + 0.18 * (fbm(p * 2.0 + t * 0.05 + phase) - 0.5);
  return exp(-d * d / (r * r));
}

// Braises : trois couches de particules qui montent à des vitesses différentes et scintillent.
float embers(vec2 p, float t) {
  float glow = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float scale = 5.0 + fi * 3.5;
    vec2 g = p * scale;
    g.y -= t * (0.55 + fi * 0.3);
    g.x += 0.35 * sin(g.y * 0.6 + fi * 2.7 + t * 0.4);
    vec2 id = floor(g);
    float h = hash(id + fi * 17.0);
    vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
    float d = length(fract(g) - 0.5 - off * 0.6);
    float flicker = 0.55 + 0.45 * sin(t * (3.0 + h * 5.0) + h * 40.0);
    glow += step(0.78, h) * smoothstep(0.14, 0.0, d) * flicker * (0.9 - fi * 0.22);
  }
  return glow * smoothstep(0.75, -0.55, p.y);
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
  col += mix(vec3(0.95, 0.15, 0.10), vec3(1.0, 0.45, 0.15), 0.5 + 0.5 * sin(p.x * 1.3 + t * 0.07)) * curtain * 0.26;

  // 5. Reflets réfractés.
  float caustic = pow(abs(sin(f * 17.0 + r.y * 6.0 - t * 0.42)), 18.0);
  col += vec3(1.0, 0.62, 0.45) * caustic * 0.15 * smoothstep(0.35, 0.7, f);

  // 6. Braises.
  col += vec3(1.0, 0.45, 0.12) * embers(p, now) * 0.85;

  // Réactions : ondes des appuis, onde de choc, respiration du repos.
  col += vec3(1.0, 0.4, 0.3) * abs(rings) * 0.45;
  vec3 shockColor = mix(vec3(1.0, 0.18, 0.12), vec3(1.0, 0.78, 0.30), uBurst.z);
  col += shockColor * shock * 0.9;
  col += shockColor * exp(-max(burstAge, 0.0) * 2.2) * step(0.0, burstAge) * uBurst.y * 0.12;
  float breath = 0.5 + 0.5 * sin(now * 6.2831 / 10.0);
  col *= 1.0 + uCalm * (breath - 0.5) * 0.7;

  // Assombrir les bords pour que le texte reste lisible.
  float vignette = smoothstep(1.35, 0.2, length(p));
  col = mix(vec3(0.05, 0.03, 0.035), col, 0.66 * vignette + 0.08);
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

export function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

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
    const u = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      clock: gl.getUniformLocation(program, 'uClock'),
      ripples: gl.getUniformLocation(program, 'uRipples'),
      burst: gl.getUniformLocation(program, 'uBurst'),
      calm: gl.getUniformLocation(program, 'uCalm'),
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
    let reduced = motionQuery.matches;
    let raf = 0;
    let lastFrame = 0;

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
      const resting = restEndsAt !== null && Date.now() < restEndsAt;
      if (restEndsAt !== null && !resting) {
        // Fin du repos : une vague rouge part du centre.
        restEndsAt = null;
        burst.set([clock(now), 0.8, 0]);
      }
      const ease = Math.min(1, dt * 1.2);
      calm += ((resting ? 1 : 0) - calm) * ease;
      speed += ((resting ? 0.35 : 1) - speed) * ease;
      flow += dt * speed;

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
      resize();
      lastNow = performance.now();
      if (reduced) draw(performance.now()); // mouvement réduit demandé : image fixe
      else if (document.visibilityState === 'visible') raf = requestAnimationFrame(loop);
    };

    // Un appui n'importe où : une onde naît sous le doigt.
    const onPointer = (event: PointerEvent) => {
      if (reduced) return;
      const scale = Math.min(window.innerWidth, window.innerHeight);
      const x = (event.clientX - window.innerWidth / 2) / scale;
      const y = (window.innerHeight / 2 - event.clientY) / scale;
      ripples.set([x, y, clock(performance.now())], nextRipple * 3);
      nextRipple = (nextRipple + 1) % MAX_RIPPLES;
    };

    const stopAmbient = onAmbient((event) => {
      if (event.kind === 'record') burst.set([clock(performance.now()), 1.2, 1]);
      else restEndsAt = event.endsAt;
    });

    const onVisibility = () => {
      // Appli en arrière-plan : on arrête de calculer, la batterie dit merci.
      if (document.visibilityState === 'visible') start();
      else cancelAnimationFrame(raf);
    };
    const onMotionChange = () => {
      reduced = motionQuery.matches;
      start();
    };
    const onResize = () => {
      resize();
      if (reduced) draw(performance.now());
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      setFallback(true);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotionChange);
    canvas.addEventListener('webglcontextlost', onLost);
    start();

    return () => {
      cancelAnimationFrame(raf);
      stopAmbient();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('webglcontextlost', onLost);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {fallback ? (
        <div className="ambient-fallback">
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : (
        <canvas ref={canvasRef} className="block h-full w-full" />
      )}
    </div>
  );
}
