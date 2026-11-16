import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import { LiquidBackground } from './ui/LiquidBackground';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Monté une seule fois, hors des pages : il ne se réinitialise jamais en changeant d'écran. */}
    <LiquidBackground />
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
