'use client';

import { useState } from 'react';
import type { Session } from '../../lib/session';
import { AccountMenu } from '../AccountMenu';

const navigation = [
  { label: 'Comandos', href: '/comandos' },
  { label: 'Módulos', href: '/modulos' },
  { label: 'Termos de serviço', notice: 'Os termos de serviço estarão disponíveis em breve.' },
  { label: 'Painel de controle', href: '/dashboard' },
] as const;

type TopBarProps = {
  avatarUrl: string;
  light: boolean;
  onToggleTheme: () => void;
  onNotice: (message: string) => void;
  session: Session | null;
  onLogout: () => void;
};

const iconButton = 'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-control bg-surface p-0 text-muted hover:border-text min-[701px]:size-9';

function TopBar({ avatarUrl, light, onToggleTheme, onNotice, session, onLogout }: TopBarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const themeLabel = light ? 'Ativar tema escuro' : 'Ativar tema claro';

  const renderItem = (item: (typeof navigation)[number], className: string) =>
    'href' in item ? (
      <a key={item.label} className={className} href={item.href}>
        {item.label}
      </a>
    ) : (
      <button
        key={item.label}
        className={`bg-transparent p-0 text-left ${className}`}
        type="button"
        onClick={() => {
          setMenuOpen(false);
          onNotice(item.notice);
        }}
      >
        {item.label}
      </button>
    );

  return (
    <>
      <header className="relative flex items-center gap-3 px-5 py-3 min-[701px]:hidden">
        <a className="mr-auto flex items-center gap-3 text-base font-semibold" href="/" aria-label="Kuruttina — início">
          {avatarUrl && !avatarFailed ? (
            <img className="size-9 rounded-full bg-surface object-cover" src={avatarUrl} alt="" width={36} height={36} onError={() => setAvatarFailed(true)} />
          ) : null}
          <span>Kuruttina</span>
        </a>
        <button className={iconButton} type="button" aria-label={themeLabel} aria-pressed={light} onClick={onToggleTheme}>
          <img src="/icons/theme/theme-mobile.svg" alt="" />
        </button>
        <AccountMenu session={session} onLogout={onLogout} />
        <button
          className="inline-flex min-h-11 items-center rounded-full border border-control bg-surface px-4 text-sm font-medium text-text"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="menu-celular"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Fechar' : 'Menu'}
        </button>
        {menuOpen ? (
          <nav id="menu-celular" className="absolute top-full right-5 left-5 z-10 flex flex-col rounded-xl border border-border bg-surface p-2" aria-label="Navegação principal">
            {navigation.map((item) => renderItem(item, 'flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-text'))}
          </nav>
        ) : null}
      </header>

      <header className="hidden min-[701px]:flex min-[701px]:flex-wrap min-[701px]:items-center min-[701px]:gap-5 min-[701px]:border-b min-[701px]:border-border min-[701px]:px-[5%] min-[701px]:py-7 min-[1101px]:flex-nowrap min-[1101px]:gap-7">
        <a className="mr-auto flex items-center gap-3 text-base font-semibold" href="/" aria-label="Kuruttina — início">
          {avatarUrl && !avatarFailed ? (
            <img className="size-9 rounded-full bg-surface object-cover" src={avatarUrl} alt="" width={36} height={36} onError={() => setAvatarFailed(true)} />
          ) : null}
          <span>Kuruttina</span>
        </a>
        <nav className="flex items-center gap-7 min-[701px]:order-3 min-[701px]:w-full min-[1101px]:order-none min-[1101px]:w-auto" aria-label="Navegação principal">
          {navigation.map((item) => renderItem(item, 'text-sm font-medium whitespace-nowrap text-muted hover:text-text'))}
        </nav>
        <div className="flex items-center gap-7">
          <button className={iconButton} type="button" aria-label={themeLabel} aria-pressed={light} onClick={onToggleTheme}>
            <img src="/icons/theme/theme.svg" alt="" />
          </button>
          <span className="flex items-center gap-2 text-[13px] font-medium whitespace-nowrap" aria-label="Idioma: português do Brasil">
            <img src="/icons/language/brasil.svg" alt="" />
            pt-BR (Brasil)
          </span>
          <AccountMenu session={session} onLogout={onLogout} />
        </div>
      </header>
    </>
  );
}

export { TopBar };
