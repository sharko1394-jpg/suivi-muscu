import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import { Ambience } from './ui/Ambience';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Fond et personnalisation : montés une seule fois, hors des pages, ils ne se réinitialisent jamais. */}
    <Ambience />
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
