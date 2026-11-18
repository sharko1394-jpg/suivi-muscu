import { useEffect, useRef, useState } from 'react';
import type { BackgroundSettings, PatternId } from '../data';
import { hexToRgb } from './theme';

/*
 * Fonds en lignes (2.3), dessinés en continu par la carte graphique :
 *  - lignes de niveau : le relief d'une carte topographique, qui se déforme lentement ;
 *  - ondes : des lignes parallèles qui ondulent comme de l'eau ;
 *  - grille : un quadrillage qui dérive, éclairé par des nappes de lumière ;
 *  - trame : des points dont la taille suit une vague (effet journal) ;
 *  - verre cannelé : des lueurs qui bougent derrière une vitre à cannelures.
 * Deux couleurs seulement : le fond et les lignes. Les bords sont assombris pour garder le texte lisible.
 * Les réactions (onde sous le doigt, record, repos) sont dessinées par-dessus en CSS.
 */

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uMode;
uniform vec3 uBg;
uniform vec3 uLine;
uniform float uGain;

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
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// Relief de la carte : deux couches qui glissent l'une sur l'autre, il se déforme sans jamais boucler.
float relief(vec2 p, float t) {
  return 0.65 * fbm(p * 1.25 + vec2(0.0, t * 0.035)) + 0.35 * fbm(p * 2.2 - vec2(t * 0.025, 0.0) + 3.7);
}
// Ondes : la hauteur des lignes parallèles.
float swell(vec2 p, float t) {
  return p.y + 0.22 * fbm(vec2(p.x * 1.1 + t * 0.06, p.y * 0.7 - t * 0.025)) + 0.05 * sin(p.x * 3.0 + t * 0.3);
}

// Trait fin et net le long des valeurs entières de v, quelle que soit la pente.
float lines(float v, float slope, float px, float width) {
  float d = abs(fract(v + 0.5) - 0.5);
  float w = max(slope * px, 1e-4);
  return 1.0 - smoothstep(w * width, w * (width + 1.2), d);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float px = 1.0 / min(uRes.x, uRes.y);
  float t = uTime;
  float a = 0.0;
  vec3 col = uBg;

  if (uMode < 0.5) {
    // Lignes de niveau, une ligne maîtresse plus marquée toutes les cinq.
    float k = 30.0;
    float h = relief(p, t);
    float e = 0.004;
    vec2 g = vec2(relief(p + vec2(e, 0.0), t) - h, relief(p + vec2(0.0, e), t) - h) / e;
    float v = h * k;
    float slope = length(g) * k;
    float major = step(mod(floor(v + 0.5), 5.0), 0.5);
    a = lines(v, slope, px, mix(0.35, 0.9, major)) * mix(0.55, 1.0, major);
  } else if (uMode < 1.5) {
    // Ondes.
    float k = 26.0;
    float h = swell(p, t);
    float e = 0.004;
    vec2 g = vec2(swell(p + vec2(e, 0.0), t) - h, swell(p + vec2(0.0, e), t) - h) / e;
    a = lines(h * k, length(g) * k, px, 0.45) * (0.55 + 0.45 * fbm(p * 1.4 + t * 0.03));
  } else if (uMode < 2.5) {
    // Grille qui dérive, éclairée par des nappes de lumière.
    float cell = 0.1;
    vec2 gv = (p + vec2(t * 0.012, t * 0.006)) / cell;
    float lx = lines(gv.x, 1.0 / cell, px, 0.35);
    float ly = lines(gv.y, 1.0 / cell, px, 0.35);
    float light = 0.18 + 0.95 * smoothstep(0.42, 0.78, fbm(p * 1.5 + vec2(t * 0.04, -t * 0.03)));
    a = max(lx, ly) * light;
    vec2 f = fract(gv + 0.5) - 0.5;
    a += (1.0 - smoothstep(0.06, 0.11, length(f))) * light * 0.6;
  } else if (uMode < 3.5) {
    // Trame de points : leur taille suit une vague lente.
    float cell = 0.042;
    vec2 gv = p / cell;
    vec2 id = floor(gv) + 0.5;
    vec2 f = gv - id;
    float field = fbm(id * cell * 1.7 + vec2(t * 0.05, -t * 0.035));
    float r = 0.06 + 0.36 * smoothstep(0.3, 0.75, field);
    float w = px / cell;
    a = 1.0 - smoothstep(r - w, r + w, length(f));
  } else {
    // Verre cannelé : des lueurs passent derrière des cannelures verticales.
    float ribs = 15.0;
    float x = p.x * ribs;
    float rib = fract(x);
    vec2 q = p + vec2((rib - 0.5) * 0.12, 0.0);
    float glow = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 c = 0.45 * vec2(sin(t * (0.07 + fi * 0.02) + fi * 2.1), cos(t * (0.05 + fi * 0.017) + fi * 1.3));
      float d = length((q - c) * vec2(1.0, 0.8));
      glow += exp(-d * d / 0.09) * (0.8 - fi * 0.15);
    }
    glow += 0.35 * fbm(q * 2.0 + t * 0.05);
    float shade = 0.72 + 0.28 * sin(rib * 3.14159);
    float edge = pow(rib, 18.0) * 0.5 + pow(1.0 - rib, 30.0) * 0.25;
    col = mix(uBg, uLine, clamp(glow * 0.75 * uGain, 0.0, 1.0)) * shade + uLine * edge * 0.25;
  }

  if (uMode < 3.5) col = mix(uBg, uLine, clamp(a * 0.85 * uGain, 0.0, 1.0));

  // Bords assombris : le texte reste lisible.
  float vignette = smoothstep(1.3, 0.25, length(p));
  col = mix(uBg * 0.55, col, 0.35 + 0.65 * vignette);
  gl_FragColor = vec4(col, 1.0);
}
`;

const MODES: Record<PatternId, number> = { contours: 0, waves: 1, grid: 2, dots: 3, fluted: 4 };

const rgb01 = (hex: string) => hexToRgb(hex).map((c) => c / 255) as [number, number, number];

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Fond en lignes :', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Fond en lignes. `still` : une image fixe (réduire les animations). */
export function PatternBackground({ background, still }: { background: BackgroundSettings; still: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ background, still });
  settings.current = { background, still };
  const control = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    if (!canvas || !gl) {
      setFailed(true);
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      setFailed(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u('uRes');
    const uTime = u('uTime');
    const uMode = u('uMode');
    const uBg = u('uBg');
    const uLine = u('uLine');
    const uGain = u('uGain');

    // Des traits fins demandent plus de détail que le fond liquide : 1,2 point par point d'écran au plus.
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.6;
    const frameMs = window.matchMedia('(pointer: coarse)').matches ? 1000 / 30 : 1000 / 60;
    let flow = Math.random() * 400;
    let last = performance.now();
    let lastFrame = 0;
    let raf = 0;

    const resize = () => {
      const width = Math.max(1, Math.round(window.innerWidth * scale));
      const height = Math.max(1, Math.round(window.innerHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(uRes, width, height);
    };
    const draw = (now: number) => {
      const { background: b } = settings.current;
      flow += Math.min(0.1, (now - last) / 1000) * b.speed;
      last = now;
      gl.uniform1f(uTime, flow);
      gl.uniform1f(uMode, MODES[b.pattern]);
      gl.uniform3fv(uBg, rgb01(b.patternBg));
      gl.uniform3fv(uLine, rgb01(b.patternLine));
      gl.uniform1f(uGain, b.intensity);
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
      last = performance.now();
      if (settings.current.still) draw(last);
      else if (document.visibilityState === 'visible') raf = requestAnimationFrame(loop);
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : cancelAnimationFrame(raf));
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      setFailed(true);
    };
    control.current = start;
    window.addEventListener('resize', start);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);
    start();
    return () => {
      cancelAnimationFrame(raf);
      control.current = null;
      window.removeEventListener('resize', start);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
    };
  }, []);

  // Autre motif, autres couleurs, ou animations réduites : le dessin suit.
  const key = JSON.stringify([background.pattern, background.patternBg, background.patternLine, background.intensity, still]);
  useEffect(() => {
    control.current?.();
  }, [key]);

  if (failed) return <div className="absolute inset-0" style={{ background: background.patternBg }} />;
  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />;
}
