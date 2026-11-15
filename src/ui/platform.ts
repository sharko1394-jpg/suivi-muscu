/** iPhone ou iPad (les iPad récents se présentent comme des Mac tactiles). */
export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Vrai si l'appli est lancée depuis l'écran d'accueil (et non dans un onglet du navigateur). */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type SaveResult = 'saved' | 'cancelled' | 'needs-gesture';

/**
 * Remet un fichier à l'utilisateur.
 * Sur iPhone, on passe par la feuille de partage (« Enregistrer dans Fichiers ») :
 * le téléchargement direct n'est pas fiable pour une appli de l'écran d'accueil.
 * Ailleurs, téléchargement classique.
 */
export async function saveFile(file: File): Promise<SaveResult> {
  const canShareFile =
    typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true;

  if (canShareFile && (isIOS() || isStandalone())) {
    try {
      await navigator.share({ files: [file] });
      return 'saved';
    } catch (error) {
      const name = (error as DOMException).name;
      if (name === 'AbortError') return 'cancelled';
      // Safari refuse le partage s'il ne suit pas immédiatement un appui :
      // l'appelant redemande alors un appui, fichier déjà prêt.
      if (name === 'NotAllowedError') return 'needs-gesture';
      // Autre échec : on retombe sur le téléchargement.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'saved';
}
