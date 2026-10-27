'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Guild, Session } from './session';
import { MessageTemplatesSection } from '../components/MessageTemplates';

type Section = 'overview' | 'messages' | 'modules';

const card = 'rounded-[14px] border border-border bg-surface';
const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-[10px] border-0 bg-button px-5 text-sm font-semibold text-button-text hover:bg-secondary';
const outlineButton = 'inline-flex min-h-11 items-center justify-center rounded-[10px] border border-control bg-transparent px-4 text-sm font-medium text-text hover:bg-surface';
const memberFormat = new Intl.NumberFormat('pt-BR');

function initials(name: string): string {
  return name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => [...part][0] ?? '').join('').toUpperCase();
}

function GuildIcon({ guild, size }: { guild: Guild; size: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'size-11 rounded-xl text-base' : 'size-9 rounded-[10px] text-sm';
  return guild.iconUrl ? (
    <img className={`${box} shrink-0 object-cover`} src={guild.iconUrl} alt="" width={64} height={64} />
  ) : (
    <span aria-hidden="true" className={`${box} flex shrink-0 items-center justify-center bg-border font-semibold`}>{initials(guild.name)}</span>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-border motion-reduce:animate-none ${className}`} />;
}

export { card, primaryButton, outlineButton, Skeleton };

function Message({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-[420px] text-sm leading-6 text-muted">{children}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

type PanelPageProps = {
  session: Session | null;
  failed: boolean;
  onLogout: () => void;
};

function PanelPage({ session, failed, onLogout }: PanelPageProps) {
  const [guildId, setGuildId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('overview');

  useEffect(() => {
    if (session && !session.authenticated) location.replace('/login');
  }, [session]);

  const guilds = session?.guilds ?? [];
  const guild = guilds.find((item) => item.id === guildId);

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
      <main id="conteudo" className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-5 py-12 min-[701px]:px-[5%]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] font-semibold">Escolha um servidor</h1>
            <p className="text-[15px] text-muted">Aparecem só os servidores em que você tem permissão de gerenciar.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className={outlineButton} type="button" onClick={onLogout}>Sair</button>
          </div>
        </div>
        {guilds.length === 0 ? (
          <Message title="Nenhum servidor para configurar">
            Você precisa ter a permissão “Gerenciar servidor” em um servidor. Peça a quem administra, ou adicione o bot ao seu servidor.
          </Message>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {guilds.map((item) => (
              <li key={item.id}>
                <button
                  className={`${card} flex min-h-[72px] w-full items-center gap-4 px-5 py-3 text-left text-text hover:border-text`}
                  type="button"
                  onClick={() => {
                    setGuildId(item.id);
                    setSection('overview');
                  }}
                >
                  <GuildIcon guild={item} size="lg" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-base font-medium">{item.name}</span>
                    {item.members !== null ? <span className="text-[13px] text-muted">{memberFormat.format(item.members)} membros</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
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
          <button className={outlineButton} type="button" onClick={() => setGuildId(null)}>Trocar de servidor</button>
          <button className={outlineButton} type="button" onClick={onLogout}>Sair</button>
        </div>
      </aside>

      <main id="conteudo" className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-5 py-8 min-[701px]:px-[5%]">
        {section === 'overview' ? (
          <>
            <h1 className="text-[28px] font-semibold">Visão geral</h1>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
              <div className={`${card} flex flex-col gap-2 p-5`}>
                <span className="text-[13px] text-muted">Membros</span>
                <span className="text-[32px] font-semibold">{guild.members !== null ? memberFormat.format(guild.members) : '—'}</span>
              </div>
              <div className={`${card} flex flex-col gap-2 p-5`}>
                <span className="text-[13px] text-muted">ID do servidor</span>
                <span className="font-mono text-base break-all">{guild.id}</span>
              </div>
            </div>
          </>
        ) : section === 'messages' ? (
          <MessageTemplatesSection guildId={guild.id} />
        ) : (
          <>
            <h1 className="text-[28px] font-semibold">Módulos</h1>
            <Message title="Módulos em construção">
              <svg className="mx-auto mb-3 size-10 text-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
              </svg>
              A configuração dos módulos de {guild.name} aparece aqui quando estiver pronta.
            </Message>
          </>
        )}
      </main>
    </div>
  );
}

export { PanelPage };
