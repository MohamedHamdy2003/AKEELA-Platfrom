import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@akeela/brand/tokens.css';
import './styles.css';
import { App } from './app';
import brandIcon from '@akeela/brand/icon.png';

const icon = document.createElement('link');
icon.rel = 'icon';
icon.href = brandIcon;
document.head.append(icon);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
