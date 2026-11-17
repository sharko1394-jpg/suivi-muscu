// Image du bilan, à partager ou à garder dans la galerie. Dessinée sur le téléphone (rien n'est envoyé).

export interface RecapImageContent {
  /** Petit titre au-dessus : « Mon bilan du mois ». */
  kicker: string;
  title: string;
  /** Le grand chiffre et ce qu'il compte. */
  big: { value: string; label: string };
  tiles: { label: string; value: string }[];
  /** Liste du bas (exercices les plus travaillés, records…). */
  listTitle: string;
  list: { label: string; value: string }[];
  footer: string;
}

const W = 1080;
const H = 1350;
const FONT = '"Poppins", system-ui, -apple-system, "Segoe UI", sans-serif';

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Coupe un texte trop long pour sa place, avec « … ». */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export async function drawRecapImage(content: RecapImageContent): Promise<Blob> {
  // La police de l'appli doit être prête, sinon le dessin prendrait une police de secours.
  await Promise.all([
    document.fonts.load(`700 90px ${FONT}`),
    document.fonts.load(`600 40px ${FONT}`),
    document.fonts.load(`500 34px ${FONT}`),
  ]).catch(() => undefined);

  const accent = cssColor('--color-accent', '#b5121b');
  const bright = cssColor('--color-accent-bright', '#ff5c52');
  const bg = cssColor('--color-bg', '#121213');
  const gold = cssColor('--color-gold', '#ffd60a');

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fond sombre et deux halos de la couleur principale, comme le fond de l'appli.
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const halo = (x: number, y: number, r: number, alpha: number) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  };
  halo(930, 120, 720, 0.75);
  halo(80, 1300, 640, 0.45);

  const muted = 'rgba(245, 245, 247, 0.62)';
  const ink = '#f5f5f7';
  const left = 80;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = muted;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(content.kicker.toUpperCase(), left, 150);

  ctx.fillStyle = ink;
  ctx.font = `700 92px ${FONT}`;
  ctx.fillText(fit(ctx, content.title, W - 2 * left), left, 255);

  // Le grand chiffre.
  ctx.font = `800 250px ${FONT}`;
  ctx.fillStyle = bright;
  ctx.fillText(content.big.value, left - 8, 520);
  const bigWidth = ctx.measureText(content.big.value).width;
  ctx.font = `600 56px ${FONT}`;
  ctx.fillStyle = ink;
  ctx.fillText(content.big.label, left + bigWidth + 18, 510);

  // Tuiles : deux colonnes.
  const tileW = (W - 2 * left - 30) / 2;
  const tileH = 180;
  content.tiles.slice(0, 4).forEach((tile, index) => {
    const x = left + (index % 2) * (tileW + 30);
    const y = 590 + Math.floor(index / 2) * (tileH + 30);
    roundRect(ctx, x, y, tileW, tileH, 40);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `700 68px ${FONT}`;
    ctx.fillText(fit(ctx, tile.value, tileW - 70), x + 36, y + 98);
    ctx.fillStyle = muted;
    ctx.font = `500 32px ${FONT}`;
    ctx.fillText(fit(ctx, tile.label, tileW - 70), x + 36, y + 146);
  });

  // Liste du bas.
  if (content.list.length > 0) {
    ctx.fillStyle = muted;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText(content.listTitle.toUpperCase(), left, 1040);
    content.list.slice(0, 3).forEach((row, index) => {
      const y = 1100 + index * 58;
      ctx.font = `600 38px ${FONT}`;
      ctx.fillStyle = gold;
      const value = row.value;
      const valueWidth = ctx.measureText(value).width;
      ctx.fillText(value, W - left - valueWidth, y);
      ctx.fillStyle = ink;
      ctx.font = `500 38px ${FONT}`;
      ctx.fillText(fit(ctx, row.label, W - 2 * left - valueWidth - 40), left, y);
    });
  }

  ctx.fillStyle = muted;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(content.footer, left, H - 60);
  ctx.fillStyle = bright;
  ctx.beginPath();
  ctx.arc(W - left - 10, H - 70, 10, 0, Math.PI * 2);
  ctx.fill();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image impossible à créer'))), 'image/png'),
  );
}
