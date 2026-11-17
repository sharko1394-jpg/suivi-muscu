import { AppError } from '../data';

/** Côté le plus long d'une photo de fond : net sur un iPhone, sans alourdir les sauvegardes. */
const MAX_SIDE = 1800;
/** Taille visée du texte « data: » (environ 2 Mo d'image). */
const TARGET_CHARS = 2_800_000;

/**
 * Prépare une photo pour servir de fond : réduite, recompressée en JPEG, prête à être enregistrée.
 * Tout se passe sur le téléphone : la photo n'est envoyée nulle part.
 */
export async function prepareBackgroundImage(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (file.type !== '' && !file.type.startsWith('image/')) {
    throw new AppError('Choisis une photo ou une image.');
  }
  const url = URL.createObjectURL(file);
  try {
    // Une balise image respecte l'orientation de la photo (portrait ou paysage).
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new AppError('Cette image n’a pas pu être ouverte.'));
      img.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new AppError('Cette image n’a pas pu être préparée.');
    context.drawImage(image, 0, 0, width, height);

    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > TARGET_CHARS && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return { dataUrl, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Nom d'une photo d'après son fichier (« IMG_2041 »), sans l'extension. */
export function photoName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Photo';
}

/** Rend une photo de fond sous forme de fichier, pour l'enregistrer ou la partager. */
export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${name}.${extension}`, { type: blob.type });
}
