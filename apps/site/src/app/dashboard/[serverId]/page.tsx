'use client';

import { useEffect, useState } from 'react';
import type { Session } from '../../../lib/session';
import { OverviewView } from './overview/view';
import { MessagesView } from './messages/view';
import { ModulesView } from './modules/view';
import { primaryButton, outlineButton, GuildIcon, Skeleton, Message } from '../ui';

type Section = 'overview' | 'messages' | 'modules';

type ServerDashboardPageProps = {
  session: Session | null;
  failed: boolean;
  serverId: string;
  onLogout: () => void;
};

function ServerDashboardPage({ session, failed, serverId, onLogout }: ServerDashboardPageProps) {
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
        <div role="status" aria-label="Carregando" className="flex flex-col gap-3">
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
        </div>
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
    <div className="flex flex-1 flex-wrap">
      <aside className="flex min-w-0 flex-[0_0_240px] flex-col gap-5 border-r border-border p-5 max-[700px]:flex-[1_1_100%] max-[700px]:border-r-0 max-[700px]:border-b">
        <div className="flex items-center gap-3">
          <GuildIcon guild={guild} size="sm" />
          <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">{guild.name}</span>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Seções do servidor">
          {([
            ['overview', 'Visão geral'],
            ['messages', 'Mensagens'],
            ['modules', 'Módulos'],
          ] as const).map(([target, label]) => (
            <button
              key={target}
              className={`flex min-h-11 items-center rounded-[10px] border-0 px-3 text-left text-sm font-medium ${section === target ? 'bg-border text-text' : 'bg-transparent text-muted hover:text-text'}`}
              type="button"
              aria-current={section === target ? 'page' : undefined}
              onClick={() => setSection(target)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <a className={outlineButton} href="/dashboard">Trocar de servidor</a>
          <button className={outlineButton} type="button" onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <main id="conteudo" className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-5 py-8 min-[701px]:px-[5%]">
        {section === 'overview' ? (
          <OverviewView guild={guild} />
        ) : section === 'messages' ? (
          <MessagesView guildId={guild.id} />
        ) : (
          <ModulesView guildName={guild.name} />
        )}
      </main>
    </div>
  );
}

export { ServerDashboardPage };
