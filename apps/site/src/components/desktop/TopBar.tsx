'use client';

import { useState } from 'react';

const navigation = [
  { label: 'Comandos', notice: 'O catálogo de comandos está em preparação.' },
  { label: 'Módulos', notice: 'A página de módulos está em preparação.' },
  { label: 'Termos de serviço', notice: 'Os termos de serviço ainda não foram publicados.' },
  { label: 'Painel de controle', notice: 'O painel de controle ainda está em desenvolvimento.' },
] as const;

type TopBarProps = {
  avatarUrl: string;
  light: boolean;
  onToggleTheme: () => void;
  onNotice: (message: string) => void;
};

function TopBar({ avatarUrl, light, onToggleTheme, onNotice }: TopBarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <header className="hidden min-[701px]:flex min-[701px]:flex-wrap min-[701px]:items-center min-[701px]:gap-5 min-[701px]:border-b min-[701px]:border-border min-[701px]:px-[5%] min-[701px]:py-7 min-[1101px]:flex-nowrap min-[1101px]:gap-7">
      <a className="mr-auto flex items-center gap-3 text-base font-semibold" href="/" aria-label="Kuruttina — início">
        {avatarUrl && !avatarFailed ? (
          <img
            className="size-9 rounded-full bg-surface object-cover"
            src={avatarUrl}
            alt=""
            width={36}
            height={36}
            onError={() => setAvatarFailed(true)}
          />
        ) : null}
        <span>Kuruttina</span>
      </a>
      <nav className="flex items-center gap-7 min-[701px]:order-3 min-[701px]:w-full min-[1101px]:order-none min-[1101px]:w-auto" aria-label="Navegação principal">
        {navigation.map((item) => (
          <button
            key={item.label}
            className="bg-transparent p-0 text-sm font-medium whitespace-nowrap text-muted"
            type="button"
            onClick={() => onNotice(item.notice)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-7">
        <button
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface p-0 text-muted"
          type="button"
          aria-label={light ? 'Ativar tema escuro' : 'Ativar tema claro'}
          aria-pressed={light}
          onClick={onToggleTheme}
        >
          <img src="/icons/theme/theme.svg" alt="" />
        </button>
        <span className="flex items-center gap-2 text-[13px] font-medium whitespace-nowrap" aria-label="Idioma: português do Brasil">
          <img src="/icons/language/brasil.svg" alt="" />
          pt-BR (Brasil)
        </span>
        <button
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface p-0 text-muted"
          type="button"
          aria-label="Minha conta"
          onClick={() => onNotice('O acesso à conta estará disponível junto com o painel.')}
        >
          <img src="/icons/account/user.svg" alt="" />
        </button>
      </div>
    </header>
  );
}

export { TopBar };
