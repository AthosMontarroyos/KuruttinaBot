'use client';

import { useSyncExternalStore } from 'react';

// Rotas respondidas pelo servidor (login OAuth, API): precisam de uma navegação real, não de uma troca de tela.
const serverPaths = /^\/(?:auth|api)\//u;

type Listener = () => void;

// Um único listener de clique e de popstate para o site inteiro: todo `usePathname` lê o mesmo estado.
// Registrar um listener por componente fazia o primeiro a rodar cancelar o clique para os outros, e a tela não trocava.
const listeners = new Set<Listener>();

function plainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onClick(event: MouseEvent): void {
  if (event.defaultPrevented || !plainLeftClick(event)) return;
  const anchor = (event.target as Element | null)?.closest?.('a');
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (anchor.target !== '' && anchor.target !== '_self') return;
  if (anchor.hasAttribute('download')) return;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return;
  let url: URL;
  try {
    url = new URL(href, location.href);
  } catch {
    return;
  }
  if (url.origin !== location.origin || serverPaths.test(url.pathname)) return;
  if (url.pathname === location.pathname && url.search === location.search) return;
  event.preventDefault();
  history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
  notify();
  let target: HTMLElement | null = null;
  if (url.hash.length > 1) {
    try {
      target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    } catch {
      target = null;
    }
  }
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

function subscribe(listener: Listener): () => void {
  if (listeners.size === 0) {
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', notify);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', notify);
    }
  };
}

function currentPathname(): string {
  return location.pathname;
}

/** Troca de tela sem recarregar a página. Links internos em `<a href>` passam por aqui; âncoras na mesma página continuam no navegador. */
function usePathname(): string {
  return useSyncExternalStore(subscribe, currentPathname, () => '/');
}

export { usePathname };
