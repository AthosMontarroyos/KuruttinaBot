'use client';

import { useState } from 'react';
import { GuildIcon } from '../app/dashboard/ui';
import type { Guild, Session } from '../lib/session';
import { AccountMenu } from './AccountMenu';
import { serverColumnWidth, serverContentInset } from './dashboard/shell';
import { LanguageIndicator } from './LanguageIndicator';
import { ThemeToggle } from './ThemeToggle';

type ServerTopBarProps = {
  appIconUrl: string;
  guild: Guild | undefined;
  session: Session | null;
  onLogout: () => void;
};

/**
 * Topo do painel de um servidor, dividido na mesma grade da lateral (`components/dashboard/shell.ts`): à esquerda, na largura
 * da lateral, o logo e "Servidores" alinhados ao texto dos itens, com a borda que continua a da lateral; à direita, o nome do
 * servidor na mesma borda do conteúdo e, no fim, idioma, tema e conta, que terminam onde o conteúdo termina. Os controles têm
 * tamanho único (não crescem com a tela). No celular não há coluna: só voltar, o nome e os controles. Fica fixo no alto ao rolar.
 */
function ServerTopBar({ appIconUrl, guild, session, onLogout }: ServerTopBarProps) {
  const [iconFailed, setIconFailed] = useState(false);

  return (
    <header className="z-20 flex min-h-16 items-center gap-3 border-b border-border bg-background px-3 min-[701px]:sticky min-[701px]:top-0 min-[701px]:h-[72px] min-[701px]:gap-0 min-[701px]:px-0">
      <div className={`flex shrink-0 items-center gap-3 min-[701px]:h-full min-[701px]:border-r min-[701px]:border-border min-[701px]:pr-4 min-[701px]:pl-7 ${serverColumnWidth}`}>
        <a href="/" aria-label="Kuruttina — início" className="hidden shrink-0 min-[701px]:flex">
          {appIconUrl && !iconFailed ? (
            <img className="size-10 rounded-full bg-surface object-cover" src={appIconUrl} alt="" width={40} height={40} onError={() => setIconFailed(true)} />
          ) : (
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-text">K</span>
          )}
        </a>
        <a href="/dashboard" aria-label="Voltar para os servidores" className="flex min-h-11 shrink-0 items-center gap-1.5 text-[15px] font-medium text-muted hover:text-text">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="hidden min-[701px]:inline">Servidores</span>
        </a>
      </div>
      <div className={`flex min-w-0 flex-1 items-center gap-3 ${serverContentInset}`}>
        <div className="mr-auto flex min-w-0 items-center gap-3">
          {guild ? (
            <>
              <GuildIcon guild={guild} size="sm" />
              <span className="truncate text-base font-semibold">{guild.name}</span>
            </>
          ) : (
            <span className="truncate text-base font-semibold">Servidor</span>
          )}
        </div>
        <div className="hidden min-[701px]:mr-[18px] min-[701px]:flex">
          <LanguageIndicator fixed />
        </div>
        <ThemeToggle fixed />
        <AccountMenu session={session} onLogout={onLogout} fixed />
      </div>
    </header>
  );
}

export { ServerTopBar };
