import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './shared/ui/styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

function currentBundlePath(): string | null {
  const script = Array.from(document.scripts).find((item) => item.type === 'module' && item.src.includes('/assets/'));
  return script ? new URL(script.src).pathname : null;
}

async function ensureLatestBuild(): Promise<void> {
  if (!import.meta.env.PROD || document.visibilityState !== 'visible') return;
  try {
    const response = await fetch(`/?build-check=${Date.now()}`, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
    if (!response.ok) return;
    const html = await response.text();
    const match = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)
      ?? html.match(/<script[^>]+src=["']([^"']+)["'][^>]+type=["']module["']/i);
    const latest = match?.[1] ? new URL(match[1], window.location.origin).pathname : null;
    const current = currentBundlePath();
    if (latest && current && latest !== current) window.location.reload();
  } catch {
    // Sem rede: mantém a versão já instalada e deixa o service worker servir o cache.
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      void registration.update();
      window.setInterval(() => { void registration.update(); }, 60_000);
    });
    void ensureLatestBuild();
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const key = 'gestao-sw-controller-reload';
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    window.location.reload();
  });

  window.addEventListener('pageshow', () => {
    sessionStorage.removeItem('gestao-sw-controller-reload');
    void ensureLatestBuild();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void ensureLatestBuild();
  });

  window.setInterval(() => { void ensureLatestBuild(); }, 60_000);
}
