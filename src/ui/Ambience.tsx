import { Component, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { DEFAULT_APPEARANCE, getAppearance, getCustomBackground, useLive } from '../data';
import { LiquidBackground, type AmbientConfig } from './LiquidBackground';
import { applyAppearance } from './theme';

/**
 * Habillage de l'appli : applique la personnalisation (couleurs, verre, police…) à toute la page
 * et dessine le fond. Monté une seule fois dans main.tsx, hors des pages.
 */
export function Ambience() {
  return (
    <AmbienceGuard>
      <AmbienceInner />
    </AmbienceGuard>
  );
}

function AmbienceInner() {
  // En cas de souci de lecture, l'apparence par défaut s'affiche : le fond ne doit jamais bloquer l'appli.
  const appearance = useLive(async () => {
    try {
      return await getAppearance();
    } catch {
      return DEFAULT_APPEARANCE;
    }
  }, []);

  const imageId = appearance?.background.kind === 'image' ? appearance.background.imageId : null;
  const image = useLive(async () => {
    if (!imageId) return { id: null, url: null };
    try {
      return { id: imageId, url: (await getCustomBackground(imageId))?.dataUrl ?? null };
    } catch {
      return { id: imageId, url: null };
    }
  }, [imageId]);

  useLayoutEffect(() => {
    if (appearance) applyAppearance(appearance);
  }, [appearance]);

  const config = useMemo<AmbientConfig>(() => {
    const imageReady = imageId === null || image?.id === imageId;
    if (!appearance || !imageReady) {
      return { background: null, imageUrl: null, motion: 'auto', effects: DEFAULT_APPEARANCE.effects };
    }
    const background =
      appearance.background.kind === 'image' && !image?.url
        ? { ...appearance.background, kind: 'animated' as const } // photo introuvable : fond animé
        : appearance.background;
    return {
      background,
      imageUrl: image?.url ?? null,
      motion: appearance.motion,
      effects: appearance.effects,
    };
  }, [appearance, image, imageId]);

  return <LiquidBackground config={config} />;
}

/** Si l'habillage plante, l'appli continue sans lui (fond sombre uni). */
class AmbienceGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Habillage :', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
