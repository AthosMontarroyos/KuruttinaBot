'use client';

import { useState } from 'react';
import { GuildIcon } from '../app/dashboard/ui';
import type { Guild, Session } from '../lib/session';
import { AccountMenu } from './AccountMenu';
import { ThemeToggle } from './ThemeToggle';

type ServerTopBarProps = {
  appIconUrl: string;
  guild: Guild | undefined;
  session: Session | null;
  onLogout: () => void;
};

const separator = 'hidden h-7 w-px bg-border min-[701px]:block';

function ServerTopBar({ appIconUrl, guild, session, onLogout }: ServerTopBarProps) {
  const [iconFailed, setIconFailed] = useState(false);

  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border px-3 min-[701px]:h-[72px] min-[701px]:gap-4 min-[701px]:px-[5%]">
      <a href="/" aria-label="Kuruttina — início" className="hidden shrink-0 min-[701px]:flex">
        {appIconUrl && !iconFailed ? (
          <img className="size-10 rounded-full bg-surface object-cover" src={appIconUrl} alt="" width={40} height={40} onError={() => setIconFailed(true)} />
        ) : (
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-text">K</span>
        )}
      </a>
      <span aria-hidden="true" className={separator} />
      <a href="/dashboard" aria-label="Voltar para os servidores" className="flex min-h-11 shrink-0 items-center gap-2 text-[15px] font-medium text-muted hover:text-text">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span className="hidden min-[701px]:inline">Servidores</span>
      </a>
      <span aria-hidden="true" className={separator} />
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
      <ThemeToggle />
      <AccountMenu session={session} onLogout={onLogout} />
    </header>
  );
}

export { ServerTopBar };
