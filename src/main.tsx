import { render } from 'preact';
import './styles/fonts.css';
import './styles/base.css';
import './styles/math.css';
import './styles/panels.css';
import { App } from './ui/App';
import { loadState, applyTheme, toast } from './ui/state';
import { installKeyboard } from './ui/input';
import './modes';

loadState();
applyTheme();
installKeyboard();
render(<App />, document.getElementById('app')!);

// iOS Safari aktiviert :active-Zustände nur, wenn ein Touch-Listener registriert ist
document.addEventListener('touchstart', () => undefined, { passive: true });

// Service Worker nur im Produktions-Build registrieren (Offline-Betrieb)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* z. B. bei file://-Aufruf – App läuft trotzdem */
    });
  });
  // Neue Version wurde im Hintergrund installiert
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('Update installiert – beim nächsten Start aktiv.');
  });
}
