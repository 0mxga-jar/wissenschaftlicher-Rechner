import { render } from 'preact';
import './styles/fonts.css';
import './styles/base.css';
import './styles/math.css';
import './styles/panels.css';
import { App } from './ui/App';
import { loadState, applyTheme } from './ui/state';
import { installKeyboard } from './ui/input';
import './modes';

loadState();
applyTheme();
installKeyboard();
render(<App />, document.getElementById('app')!);

// Service Worker nur im Produktions-Build registrieren (Offline-Betrieb)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* z. B. bei file://-Aufruf – App läuft trotzdem */
    });
  });
}
