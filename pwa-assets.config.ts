import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Génère les icônes de l'appli à partir de public/logo.svg (commande : npm run icons).
// Le logo a déjà son fond sombre et ses marges : pas de marge ajoutée.
const background = '#121213';

export default defineConfig({
  preset: {
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/logo.svg'],
});
