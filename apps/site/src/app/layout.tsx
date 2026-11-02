'use client';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TopBar } from '../components/desktop/TopBar';
import { ServerTopBar } from '../components/ServerTopBar';
import { Footer } from '../components/Footer';
import { HomePage } from './page';
import { LoginPage } from './login/page';
import { DashboardPage } from './dashboard/page';
import { ServerDashboardPage } from './dashboard/[serverId]/page';
import { ComandosPage } from './comandos/page';
import { ModulosPage } from './modulos/page';
import { readAppIconUrl, readHomeCoverUrl } from '../lib/bot-avatar';
import { usePathname } from '../lib/navigation';
import { useSession } from '../lib/session';
import './globals.css';

const serverDashboardPath = /^\/dashboard\/([^/]+)$/u;

function RootLayout() {
  const [notice, setNotice] = useState<string | null>(null);
  const appIconUrl = readAppIconUrl();
  const coverUrl = readHomeCoverUrl();
  const { session, failed, mockLogin, logout } = useSession();
  const pathname = usePathname();
  const serverId = serverDashboardPath.exec(pathname)?.[1];
  const serverGuild = serverId ? session?.guilds?.find((item) => item.id === serverId) : undefined;

  useEffect(() => {
    if (!notice) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setNotice(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [notice]);

  const showNotice = (message: string): void => setNotice(message);

  return (
    <>
      <a className="fixed top-[-100px] left-5 z-30 bg-surface p-3 focus:top-3" href="#conteudo">
        Pular para o conteúdo
      </a>
      {serverId ? (
        <ServerTopBar appIconUrl={appIconUrl} guild={serverGuild} session={session} onLogout={() => void logout()} />
      ) : (
        <TopBar appIconUrl={appIconUrl} onNotice={showNotice} session={session} onLogout={() => void logout()} overlay={pathname === '/'} />
      )}
      {pathname === '/dashboard' ? (
        <DashboardPage session={session} failed={failed} onLogout={() => void logout()} />
      ) : serverId ? (
        <ServerDashboardPage session={session} failed={failed} serverId={serverId} />
      ) : pathname === '/login' ? (
        <LoginPage session={session} failed={failed} onMockLogin={mockLogin} />
      ) : pathname === '/comandos' ? (
        <ComandosPage />
      ) : pathname === '/modulos' ? (
        <ModulosPage />
      ) : (
        <HomePage coverUrl={coverUrl} onNotice={showNotice} />
      )}
      {pathname === '/' || serverId ? null : <Footer />}
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
