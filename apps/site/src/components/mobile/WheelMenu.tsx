import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { navigation } from '../../lib/site-navigation';
import { usePathname } from '../../lib/navigation';
import type { Session } from '../../lib/session';
import { themeLabels, useTheme, type ThemePreference } from '../../lib/theme';
import { wheelPosition } from '../../lib/wheel';
import { CloseIcon, FileTextIcon, GridIcon, MonitorIcon, MoonIcon, PanelIcon, SunIcon, TerminalIcon, UserIcon } from '../icons';

type WheelMenuProps = {
  session: Session | null;
  onLogout: () => void;
  onNotice: (message: string) => void;
};

type IconComponent = ComponentType<{ className?: string }>;

type WheelEntry = {
  /** Texto curto sob o ícone. */
  label: string;
  /** Nome acessível completo. */
  name: string;
  Icon: IconComponent;
  current?: boolean;
} & ({ href: string } | { onSelect: () => void; keepOpen?: boolean });

const themeIcons: Record<ThemePreference, IconComponent> = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };
const navigationIcons: Record<string, IconComponent> = { Comandos: TerminalIcon, Módulos: GridIcon, 'Termos de serviço': FileTextIcon, 'Painel de controle': PanelIcon };
const shortLabels: Record<string, string> = { 'Termos de serviço': 'Termos', 'Painel de controle': 'Painel' };

const itemCircle = 'grid size-14 place-items-center rounded-full';

/**
 * Navegação do celular (até 700px), no lugar da barra superior: um botão redondo fixo no canto, sempre visível e em
 * destaque, que abre uma roleta com os links principais, o tema, a conta e o painel. O botão continua no mesmo lugar com a
 * roleta aberta e vira "Fechar". Fecha com o botão, o fundo, Esc ou ao escolher um destino.
 *
 *     <WheelMenu session={session} onLogout={logout} onNotice={showNotice} />
 */
function WheelMenu({ session, onLogout, onNotice }: WheelMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { preference, cycle } = useTheme();
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const authenticated = Boolean(session?.authenticated && session.user);

  const close = (returnFocus = false): void => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    dialog.current?.querySelector<HTMLElement>('a, button:not([tabindex="-1"])')?.focus();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    const wide = window.matchMedia('(min-width: 701px)');
    const onWide = (): void => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener('change', onWide);
    return () => {
      root.style.overflow = previous;
      wide.removeEventListener('change', onWide);
    };
  }, [open]);

  const navigationEntries = navigation.map((item): WheelEntry => {
    const base = { label: shortLabels[item.label] ?? item.label, name: item.label, Icon: navigationIcons[item.label] ?? TerminalIcon };
    if ('href' in item) return { ...base, href: item.href, current: pathname === item.href };
    return { ...base, onSelect: () => onNotice(item.notice) };
  });
  const [comandos, modulos, termos, painel] = navigationEntries;
  const account: WheelEntry = authenticated
    ? { label: 'Sair', name: `Sair da conta de ${session?.user?.label ?? ''}`, Icon: UserIcon, onSelect: onLogout }
    : { label: 'Entrar', name: 'Entrar', Icon: UserIcon, href: '/login' };
  const theme: WheelEntry = { label: 'Tema', name: themeLabels[preference], Icon: themeIcons[preference], onSelect: cycle, keepOpen: true };
  const entries = [comandos, modulos, termos, theme, account, painel].filter((entry): entry is WheelEntry => entry !== undefined);

  /** Esc fecha; Tab circula entre os itens e o botão, sem sair da roleta. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('a, button:not([tabindex="-1"])') ?? []), ...(trigger.current ? [trigger.current] : [])];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const renderEntry = (entry: WheelEntry, index: number) => {
    const position = wheelPosition(index, entries.length);
    const selected = 'current' in entry && entry.current === true;
    const content = (
      <>
        <span className={`${itemCircle} ${selected ? 'border-2 border-accent-fg bg-button text-button-text' : 'border border-control bg-surface text-text'}`}>
          <entry.Icon className="size-6" />
        </span>
        <span className="rounded-lg bg-background px-1.5 py-px text-[13px] leading-[1.3] font-semibold text-text">{entry.label}</span>
      </>
    );
    const className = 'absolute flex w-22 -translate-x-1/2 -translate-y-7 flex-col items-center gap-1.5 rounded-xl bg-transparent p-0 text-text';
    if ('href' in entry) {
      return (
        <a key={entry.name} className={className} style={position} href={entry.href} aria-label={entry.name} aria-current={selected ? 'page' : undefined} onClick={() => close()}>
          {content}
        </a>
      );
    }
    return (
      <button
        key={entry.name}
        className={className}
        style={position}
        type="button"
        aria-label={entry.name}
        onClick={() => {
          entry.onSelect();
          if (!entry.keepOpen) close();
        }}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="min-[701px]:hidden">
      {open ? (
        <div ref={dialog} role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-40" onKeyDown={onKeyDown}>
          <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 size-full cursor-default bg-terminal/70" onClick={() => close()} />
          <div className="absolute top-[54%] left-1/2 aspect-square w-[min(344px,calc(100vw-24px),calc(100dvh-32px))] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background">
            <div className="absolute inset-[18.6%] rounded-full border-2 border-border" aria-hidden="true" />
            <nav aria-label="Navegação principal">{entries.map(renderEntry)}</nav>
            <span className="absolute top-1/2 left-1/2 grid size-[25.6%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-accent-fg bg-button text-3xl font-bold text-button-text" aria-hidden="true">
              K
            </span>
          </div>
        </div>
      ) : null}
      <button
        ref={trigger}
        type="button"
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        className={`fixed right-5 bottom-[max(20px,env(safe-area-inset-bottom))] z-50 grid size-16 place-items-center rounded-full border-2 border-accent-fg bg-button text-2xl font-bold text-button-text ${open ? '' : 'animate-save-attention motion-reduce:animate-none'}`}
      >
        {open ? <CloseIcon className="size-7" /> : <span aria-hidden="true">K</span>}
      </button>
    </div>
  );
}

export { WheelMenu };
