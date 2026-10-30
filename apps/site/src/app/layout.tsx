'use client';

import { StrictMode, useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TopBar } from '../components/desktop/TopBar';
import { HomePage } from './page';
import { LoginPage } from './login/page';
import { DashboardPage } from './dashboard/page';
import { ServerDashboardPage } from './dashboard/[serverId]/page';
import { ComandosPage } from './comandos/page';
import { ModulosPage } from './modulos/page';
import { readBotAvatarUrl } from '../lib/bot-avatar';
import { useSession } from '../lib/session';
import './globals.css';

const themeStorageKey = 'kuruttina-theme';
const serverDashboardPath = /^\/dashboard\/([^/]+)$/u;

function readStoredLightTheme(): boolean {
  try {
    return localStorage.getItem(themeStorageKey) === 'light';
  } catch {
    return false;
  }
}

function RootLayout() {
  const [light, setLight] = useState(readStoredLightTheme);
  const [notice, setNotice] = useState<string | null>(null);
  const avatarUrl = readBotAvatarUrl();
  const { session, failed, mockLogin, logout } = useSession();
  const serverId = serverDashboardPath.exec(location.pathname)?.[1];

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
  }, [light]);

  useEffect(() => {
    if (!notice) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setNotice(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [notice]);

  const showNotice = (message: string): void => setNotice(message);
  const toggleTheme = (): void => {
    setLight((current) => {
      const next = !current;
      try {
        localStorage.setItem(themeStorageKey, next ? 'light' : 'dark');
      } catch {
        /* Keep the theme for this visit when storage is unavailable. */
      }
      return next;
    });
  };

  return (
    <>
      <a className="fixed top-[-100px] left-5 z-30 bg-surface p-3 focus:top-3" href="#conteudo">
        Pular para o conteúdo
      </a>
      <TopBar avatarUrl={avatarUrl} light={light} onToggleTheme={toggleTheme} onNotice={showNotice} session={session} onLogout={() => void logout()} />
      {location.pathname === '/dashboard' ? (
        <DashboardPage session={session} failed={failed} onLogout={() => void logout()} />
      ) : serverId ? (
        <ServerDashboardPage session={session} failed={failed} serverId={serverId} onLogout={() => void logout()} />
      ) : location.pathname === '/login' ? (
        <LoginPage session={session} failed={failed} onMockLogin={mockLogin} />
      ) : location.pathname === '/comandos' ? (
        <ComandosPage />
      ) : location.pathname === '/modulos' ? (
        <ModulosPage />
      ) : (
        <HomePage avatarUrl={avatarUrl} onNotice={showNotice} />
      )}
      <footer className="border-t border-border px-5 pt-5 pb-7 text-[13px] leading-4 font-medium text-subtle min-[701px]:border-0 min-[701px]:px-[5%] min-[701px]:py-6">
        Kuruttina
      </footer>
      {notice ? (
        <aside className="fixed right-6 bottom-6 z-20 flex max-w-[min(440px,calc(100%-40px))] items-center gap-5 rounded-xl border border-border bg-surface p-5" aria-label="Aviso">
          <p role="status" aria-live="polite">{notice}</p>
          <button className="border-0 bg-transparent p-0 text-text underline decoration-from-font underline-offset-[0.2em]" type="button" aria-label="Fechar aviso" onClick={() => setNotice(null)}>
            Fechar
          </button>
        </aside>
      ) : null}
    </>
  );
}

const root = document.querySelector('#root');
if (!root) throw new Error('A Home não encontrou o elemento raiz.');
createRoot(root).render(
  <StrictMode>
    <RootLayout />
  </StrictMode>,
);
