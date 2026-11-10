'use client';

import { useEffect, useState } from 'react';
import type { Session } from '../../../lib/session';
import { GuildIdProvider } from '../../../lib/guild-context';
import { OverviewView } from './overview/view';
import { EmbedsView } from './embeds/view';
import { RoleGroupsView } from './role-groups/view';
import { MemberEventsView } from './member-events/view';
import { primaryButton, outlineButton, StatusSkeleton, Message } from '../ui';

type Section = 'overview' | 'embeds' | 'member-events' | 'roles';

type ServerDashboardPageProps = {
  session: Session | null;
  failed: boolean;
  serverId: string;
};

function ServerDashboardPage({ session, failed, serverId }: ServerDashboardPageProps) {
  const [section, setSection] = useState<Section>('overview');

  useEffect(() => {
    if (session && !session.authenticated) location.replace('/login');
  }, [session]);

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

  return (
    <div className="flex flex-1 flex-wrap max-[700px]:content-start">
      <aside className="flex min-w-0 flex-[0_0_240px] flex-col border-r border-border p-5 max-[700px]:flex-[1_1_100%] max-[700px]:border-r-0 max-[700px]:border-b max-[700px]:px-3 max-[700px]:py-2">
        <nav className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[701px]:flex-col min-[701px]:gap-1 min-[701px]:overflow-visible" aria-label="Seções do servidor">
          {([
            ['overview', 'Visão geral'],
            ['embeds', 'Mensagens'],
            ['member-events', 'Entrada e saída'],
            ['roles', 'Cargos'],
          ] as const).map(([target, label]) => (
            <button
              key={target}
              className={`flex min-h-11 items-center shrink-0 whitespace-nowrap rounded-full px-4 min-[701px]:rounded-[10px] min-[701px]:px-3 border-0 text-left text-sm font-medium ${section === target ? 'bg-border text-text' : 'bg-transparent text-muted hover:text-text'}`}
              type="button"
              aria-current={section === target ? 'page' : undefined}
              onClick={() => setSection(target)}
            >
              {label}
            </button>
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
