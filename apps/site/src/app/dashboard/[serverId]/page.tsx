'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Session } from '../../../lib/session';
import { GuildIdProvider } from '../../../lib/guild-context';
import { OverviewView } from './overview/view';
import { EmbedsView } from './embeds/view';
import { RoleGroupsView } from './role-groups/view';
import { MemberEventsView } from './member-events/view';
import { primaryButton, outlineButton, StatusSkeleton, Message } from '../ui';
import { sectionIcons, type SectionId } from '../../../components/dashboard/section-icons';
import { CheckIcon, ChevronDownIcon } from '../../../components/icons';

type Section = SectionId;

const sectionGroups: { label: string; items: { id: Section; label: string }[] }[] = [
  { label: 'Geral', items: [{ id: 'overview', label: 'Visão geral' }] },
  {
    label: 'Comunidade',
    items: [
      { id: 'embeds', label: 'Mensagens' },
      { id: 'member-events', label: 'Entrada e saída' },
      { id: 'roles', label: 'Cargos' },
    ],
  },
];

const sectionItems = sectionGroups.flatMap((group) => group.items);

type ServerDashboardPageProps = {
  session: Session | null;
  failed: boolean;
  serverId: string;
};

function ServerDashboardPage({ session, failed, serverId }: ServerDashboardPageProps) {
  const [section, setSection] = useState<Section>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (session && !session.authenticated) location.replace('/login');
  }, [session]);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [menuOpen]);

  const guild = session?.guilds?.find((item) => item.id === serverId);

  if (failed) {
    return (
      <main id="conteudo" className="mx-auto w-full max-w-[880px] px-5 py-12">
        <Message title="Painel indisponível" action={<button className={primaryButton} type="button" onClick={() => location.reload()}>Tentar de novo</button>}>
          Não foi possível falar com o servidor agora.
        </Message>
      </main>
    );
  }

  if (!session?.authenticated) {
    return (
      <main id="conteudo" className="mx-auto w-full max-w-[880px] px-5 py-12">
        <StatusSkeleton label="Carregando" rows={['h-9 w-60', 'h-[72px]', 'h-[72px]']} />
      </main>
    );
  }

  if (!guild) {
    return (
      <main id="conteudo" className="mx-auto w-full max-w-[880px] px-5 py-12">
        <Message title="Servidor não encontrado" action={<a className={outlineButton} href="/dashboard">Voltar</a>}>
          Esse servidor não existe ou você não tem permissão para configurá-lo.
        </Message>
      </main>
    );
  }

  const currentLabel = sectionItems.find((item) => item.id === section)?.label ?? '';
  const CurrentIcon = sectionIcons[section];

  function pickSection(target: Section) {
    setSection(target);
    setMenuOpen(false);
    pickerButtonRef.current?.focus();
  }

  function handlePickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
      pickerButtonRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-1 flex-col min-[701px]:flex-row">
      <div ref={pickerRef} className="relative shrink-0 border-b border-border p-3 min-[701px]:hidden" onKeyDown={handlePickerKeyDown}>
        <button
          ref={pickerButtonRef}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-control bg-surface px-4 text-base font-semibold text-text hover:border-text"
          type="button"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label={`Seção do servidor: ${currentLabel}`}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <CurrentIcon className="size-5 shrink-0" />
          <span className="flex-1 text-left">{currentLabel}</span>
          <ChevronDownIcon className={`size-5 shrink-0 transition-transform motion-reduce:transition-none ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen ? (
          <div
            role="group"
            aria-label="Seções do servidor"
            className="absolute inset-x-3 top-[calc(100%_-_6px)] z-10 max-h-[560px] overflow-y-auto rounded-[14px] border border-control bg-background p-2"
          >
            {sectionGroups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label} className="flex flex-col gap-0.5 pt-2.5">
                <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{group.label}</h2>
                {group.items.map((item) => {
                  const Icon = sectionIcons[item.id];
                  const active = item.id === section;
                  return (
                    <button
                      key={item.id}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-[10px] border-0 px-3 text-left text-base font-medium ${active ? 'bg-surface font-semibold text-text' : 'bg-transparent text-muted hover:text-text'}`}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => pickSection(item.id)}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {active ? <CheckIcon className="size-[18px] shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <aside className="hidden w-[264px] min-[1101px]:w-[clamp(264px,18vw,340px)] shrink-0 border-r border-border px-4 py-6 min-[701px]:flex min-[701px]:flex-col">
        <nav aria-label="Seções do servidor" className="flex flex-col">
          {sectionGroups.map((group, index) => (
            <div key={group.label} role="group" aria-label={group.label} className={`flex flex-col gap-1 ${index > 0 ? 'mt-7' : ''}`}>
              <h2 className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{group.label}</h2>
              {group.items.map((item) => {
                const Icon = sectionIcons[item.id];
                const active = item.id === section;
                return (
                  <button
                    key={item.id}
                    className={`flex min-h-11 min-[1101px]:min-h-[clamp(44px,3vw,54px)] w-full items-center gap-3 rounded-[10px] border-0 px-3 text-left text-[15px] min-[1101px]:text-[clamp(15px,1vw,19px)] font-medium ${active ? 'bg-surface font-semibold text-text' : 'bg-transparent text-muted hover:text-text'}`}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setSection(item.id)}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main id="conteudo" className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-5 py-8 min-[701px]:px-[5%]">
        <GuildIdProvider guildId={guild.id} name={guild.name} iconUrl={guild.iconUrl}>
          {section === 'overview' ? (
            <OverviewView guild={guild} />
          ) : section === 'embeds' ? (
            <EmbedsView guildId={guild.id} />
          ) : section === 'member-events' ? (
            <MemberEventsView guildId={guild.id} />
          ) : (
            <RoleGroupsView guildId={guild.id} />
          )}
        </GuildIdProvider>
      </main>
    </div>
  );
}

export { ServerDashboardPage };
