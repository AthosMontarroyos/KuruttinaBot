'use client';

import { useState } from 'react';
import { navigation, type NavigationItem } from '../../lib/site-navigation';
import type { Session } from '../../lib/session';
import { AccountMenu } from '../AccountMenu';
import { WheelMenu } from '../mobile/WheelMenu';
import { ThemeToggle } from '../ThemeToggle';

type TopBarProps = {
  appIconUrl: string;
  onNotice: (message: string) => void;
  session: Session | null;
  onLogout: () => void;
  overlay?: boolean;
};

const desktopBrand = 'mr-auto flex items-center gap-3 text-lg font-semibold min-[1101px]:gap-4 min-[1101px]:text-[clamp(18px,1.3vw,24px)]';

function TopBar({ appIconUrl, onNotice, session, onLogout, overlay = false }: TopBarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const renderItem = (item: NavigationItem, className: string) =>
    'href' in item ? (
      <a key={item.label} className={className} href={item.href}>
        {item.label}
      </a>
    ) : (
      <button
        key={item.label}
        className={`bg-transparent p-0 text-left ${className}`}
        type="button"
        onClick={() => onNotice(item.notice)}
      >
        {item.label}
      </button>
    );

  return (
    <>
      <WheelMenu session={session} onLogout={onLogout} onNotice={onNotice} />

      <header className={`${overlay ? 'topbar-overlay ' : ''}hidden min-[701px]:flex min-[701px]:flex-wrap min-[701px]:items-center min-[701px]:gap-5 min-[701px]:border-b min-[701px]:border-border min-[701px]:px-[5%] min-[701px]:py-7 min-[1101px]:flex-nowrap min-[1101px]:gap-7`}>
        <a className={desktopBrand} href="/" aria-label="Kuruttina — início">
          {appIconUrl && !avatarFailed ? (
            <img className="size-10 rounded-full bg-surface object-cover min-[1101px]:size-[clamp(40px,2.6vw,52px)]" src={appIconUrl} alt="" width={36} height={36} onError={() => setAvatarFailed(true)} />
          ) : null}
          <span>Kuruttina</span>
        </a>
        <nav className="flex items-center gap-7 min-[701px]:order-3 min-[701px]:w-full min-[1101px]:order-none min-[1101px]:w-auto min-[1101px]:gap-[clamp(28px,2vw,44px)]" aria-label="Navegação principal">
          {navigation.map((item) => renderItem(item, 'text-[15px] font-medium whitespace-nowrap text-muted hover:text-text min-[1101px]:text-[clamp(16px,1.05vw,20px)]'))}
        </nav>
        <div className="flex items-center gap-7 min-[1101px]:gap-[clamp(28px,2vw,44px)]">
          <span className="flex items-center gap-2 text-[15px] font-medium whitespace-nowrap min-[1101px]:gap-3 min-[1101px]:text-[clamp(15px,1vw,19px)]" aria-label="Idioma: português do Brasil">
            <img className="w-[22px] min-[1101px]:w-[clamp(22px,1.4vw,28px)]" src="/icons/language/brasil.svg" alt="" />
            pt-BR (Brasil)
          </span>
          <ThemeToggle />
          <AccountMenu session={session} onLogout={onLogout} />
        </div>
      </header>
    </>
  );
}

export { TopBar };
