import { useEffect, useRef, useState } from 'react';

/*
 * Fond animé « liquide », dessiné en continu par la carte graphique (WebGL).
 *
 * Il est monté une seule fois, à la racine de l'appli : changer d'écran ne le réinitialise pas.
 * Le temps avance sans jamais revenir à zéro, donc il n'y a ni boucle visible ni retour brutal.
 *
 * Couches, de la plus profonde à la plus proche, chacune avec sa propre vitesse :
 *  1. matière liquide : bruit « replié sur lui-même » qui se déforme en permanence ;
 *  2. couleurs irisées (bleu, violet, cyan, rose) qui glissent les unes dans les autres ;
 *  3. grandes formes floues qui dérivent, gonflent et dégonflent ;
 *  4. voiles d'aurore boréale qui ondulent ;
 *  5. reflets de lumière réfractée (caustiques), comme au fond d'une piscine.
 */

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

// Bruit lisse (valeur interpolée), sans texture.
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

// Teinte irisée continue : quatre couleurs dont le poids tourne doucement, sans aucun saut.
vec3 iridescent(float x, float t) {
  vec3 blue   = vec3(0.10, 0.22, 0.85);
  vec3 violet = vec3(0.52, 0.18, 0.90);
  vec3 cyan   = vec3(0.05, 0.78, 0.92);
  vec3 pink   = vec3(0.98, 0.30, 0.68);
  float a = x * 6.2831 + t;
  vec4 w = 0.5 + 0.5 * vec4(sin(a), sin(a + 1.5708), sin(a + 3.1416), sin(a + 4.7124));
  w = w * w * w;
  return (blue * w.x + violet * w.y + cyan * w.z + pink * w.w) / (w.x + w.y + w.z + w.w);
}

// Forme floue qui dérive (trajectoire de Lissajous) et respire.
float blob(vec2 p, vec2 freq, vec2 phase, float t, float radius) {
  vec2 c = 0.55 * vec2(sin(t * freq.x + phase.x), cos(t * freq.y + phase.y));
  float r = radius * (0.75 + 0.25 * sin(t * (freq.x + freq.y) * 0.7 + phase.x));
  float d = length(p - c) + 0.18 * (fbm(p * 2.0 + t * 0.05 + phase) - 0.5);
  return exp(-d * d / (r * r));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime;

  // 1. Matière liquide : chaque couche déforme la suivante, à des vitesses déphasées.
  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t * 0.031)),
                fbm(p * 1.1 + vec2(5.2, 1.3) - t * 0.023));
  vec2 r = vec2(fbm(p * 1.4 + 2.2 * q + vec2(1.7, 9.2) + t * 0.041),
                fbm(p * 1.4 + 2.2 * q + vec2(8.3, 2.8) - t * 0.037));
  float f = fbm(p * 1.2 + 2.6 * r + t * 0.012);

  // 2. Couleurs irisées portées par le liquide.
  vec3 col = iridescent(f + 0.35 * length(q) + 0.15 * r.x, t * 0.045);
  col *= 0.25 + 0.9 * f * f;

  // 3. Grandes formes floues, chacune sur son propre rythme.
  col += iridescent(0.00, t * 0.031) * 0.55 * blob(p, vec2(0.071, 0.053), vec2(0.0, 1.3), t, 0.55);
  col += iridescent(0.27, t * 0.027) * 0.50 * blob(p, vec2(0.043, 0.067), vec2(2.1, 0.4), t, 0.50);
  col += iridescent(0.55, t * 0.038) * 0.45 * blob(p, vec2(0.059, 0.037), vec2(4.2, 3.3), t, 0.45);
  col += iridescent(0.80, t * 0.022) * 0.40 * blob(p, vec2(0.033, 0.049), vec2(1.1, 5.0), t, 0.60);

  // 4. Aurore boréale : voiles verticaux qui ondulent dans le haut de l'écran.
  float wave = p.y - 0.28 - 0.22 * sin(p.x * 1.7 + t * 0.11) - 0.18 * (fbm(vec2(p.x * 1.8, t * 0.06)) - 0.5);
  float curtain = exp(-wave * wave * 9.0) * (0.55 + 0.45 * sin(p.x * 9.0 + t * 0.35 + 5.0 * fbm(p * 2.5 + t * 0.03)));
  col += mix(vec3(0.05, 0.85, 0.75), vec3(0.55, 0.25, 1.0), 0.5 + 0.5 * sin(p.x * 1.3 + t * 0.07)) * curtain * 0.32;

  // 5. Réfraction : fins reflets lumineux qui ondulent sur le liquide.
  float caustic = pow(abs(sin(f * 17.0 + r.y * 6.0 - t * 0.42)), 18.0);
  col += vec3(0.75, 0.85, 1.0) * caustic * 0.16 * smoothstep(0.35, 0.7, f);

  // Assombrir et adoucir pour que le texte reste lisible par-dessus.
  float vignette = smoothstep(1.35, 0.2, length(p));
  col = mix(vec3(0.045, 0.045, 0.055), col, 0.62 * vignette + 0.08);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Résolution de calcul, relative à la taille affichée : le fond est flou, inutile de calculer chaque pixel. */
const RENDER_SCALE = 0.45;

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

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Téléphone ou tablette : on calcule moins d'images par seconde pour ménager la batterie. */
function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

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
    const uRes = gl.getUniformLocation(program, 'uRes');
    const uTime = gl.getUniformLocation(program, 'uTime');

    // Départ à un instant différent à chaque ouverture : le fond n'est jamais deux fois le même.
    const origin = performance.now() - Math.random() * 600_000;
    const frameMs = isTouchDevice() ? 1000 / 30 : 1000 / 60;
    let reduced = prefersReducedMotion();
    let raf = 0;
    let last = 0;

    const resize = () => {
      const width = Math.max(1, Math.round(window.innerWidth * RENDER_SCALE));
      const height = Math.max(1, Math.round(window.innerHeight * RENDER_SCALE));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(uRes, width, height);
    };

    const draw = (now: number) => {
      gl.uniform1f(uTime, (now - origin) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < frameMs - 1) return;
      last = now;
      draw(now);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      resize();
      if (reduced) {
        // Mouvement réduit demandé : une image fixe, sans animation.
        draw(performance.now());
      } else if (document.visibilityState === 'visible') {
        raf = requestAnimationFrame(loop);
      }
    };

    const onVisibility = () => {
      // Appli en arrière-plan : on arrête de calculer, la batterie dit merci.
      if (document.visibilityState === 'visible') start();
      else cancelAnimationFrame(raf);
    };
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
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
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotionChange);
    canvas.addEventListener('webglcontextlost', onLost);
    start();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
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
