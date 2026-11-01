'use client';

import { useEffect } from 'react';
import { ArrowRightIcon, PlusIcon } from '../../components/icons';
import type { Guild, Session } from '../../lib/session';
import { card, primaryButton, outlineButton, memberFormat, GuildIcon, StatusSkeleton, Message } from './ui';

type DashboardPageProps = {
  session: Session | null;
  failed: boolean;
  onLogout: () => void;
};

const grid = 'm-0 grid list-none grid-cols-1 gap-4 p-0 min-[701px]:grid-cols-2 min-[1000px]:grid-cols-3';
const cardShell = `${card} group flex h-full flex-col overflow-hidden transition-colors`;
const cardButton = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-semibold transition-colors';

/** Faixa do topo do cartão: o banner do servidor ou, sem ele, um degradê no tom do site. */
function GuildCover({ guild }: { guild: Guild }) {
  return guild.bannerUrl ? (
    <img className="h-20 w-full object-cover" src={guild.bannerUrl} alt="" loading="lazy" />
  ) : (
    <div aria-hidden="true" className="h-20 w-full bg-gradient-to-br from-accent-soft via-surface to-border" />
  );
}

function GuildHeader({ guild }: { guild: Guild }) {
  return (
    <>
      <GuildCover guild={guild} />
      <div className="-mt-7 flex flex-col gap-1 px-5">
        <span className="w-fit rounded-[14px] border-2 border-surface bg-surface"><GuildIcon guild={guild} size="xl" /></span>
        <span className="mt-1 truncate text-base font-semibold">{guild.name}</span>
        <span className="min-h-[20px] text-[13px] text-muted">{guild.members !== null ? `${memberFormat.format(guild.members)} membros` : ''}</span>
      </div>
    </>
  );
}

/** Servidor com a Kuruttina: o cartão inteiro leva ao painel, e o botão deixa isso claro. */
function ManageCard({ guild }: { guild: Guild }) {
  return (
    <li>
      <a className={`${cardShell} gap-4 pb-5 text-text hover:border-accent-fg`} href={`/dashboard/${guild.id}`} aria-label={`Abrir o painel de ${guild.name}`}>
        <GuildHeader guild={guild} />
        <span className="mt-auto px-5">
          <span className={`${cardButton} bg-button text-button-text group-hover:bg-secondary`}>
            Abrir painel
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </span>
      </a>
    </li>
  );
}

/** Servidor onde a pessoa administra, mas a Kuruttina ainda não está: o botão abre o convite já apontado para ele. */
function InviteCard({ guild }: { guild: Guild }) {
  return (
    <li>
      <div className={`${cardShell} gap-4 pb-5`}>
        <div className="opacity-80"><GuildHeader guild={guild} /></div>
        <div className="mt-auto px-5">
          {guild.inviteUrl ? (
            <a
              className={`${cardButton} border border-accent-fg text-accent-fg hover:bg-accent-soft`}
              href={guild.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Adicionar a Kuruttina ao servidor ${guild.name}`}
            >
              <PlusIcon />
              Adicionar a Kuruttina
            </a>
          ) : (
            <span className={`${cardButton} border border-border text-muted`}>Convite indisponível</span>
          )}
        </div>
      </div>
    </li>
  );
}

function DashboardPage({ session, failed, onLogout }: DashboardPageProps) {
  useEffect(() => {
    if (session && !session.authenticated) location.replace('/login');
  }, [session]);

  const guilds = session?.guilds ?? [];
  // Servidores com a Kuruttina vêm primeiro (a ordem do servidor é mantida dentro de cada grupo).
  // `botIn === false` é a única certeza de que o bot não está; sem essa informação o painel abre normalmente.
  const ordered = [...guilds].sort((a, b) => Number(b.botIn !== false) - Number(a.botIn !== false));

  if (failed) {
    return (
      <main id="conteudo" className="mx-auto w-full max-w-[1040px] px-5 py-12">
        <Message title="Painel indisponível" action={<button className={primaryButton} type="button" onClick={() => location.reload()}>Tentar de novo</button>}>
          Não foi possível falar com o servidor agora.
        </Message>
      </main>
    );
  }

  if (!session?.authenticated) {
    return (
      <main id="conteudo" className="mx-auto w-full max-w-[1040px] px-5 py-12">
        <StatusSkeleton label="Carregando" rows={['h-9 w-60', 'h-[72px]', 'h-[72px]']} />
      </main>
    );
  }

  return (
    <main id="conteudo" className="mx-auto flex w-full max-w-[1040px] flex-col gap-8 px-5 py-12 min-[701px]:px-[5%]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold">Escolha um servidor</h1>
          <p className="text-[15px] text-muted">Aparecem os servidores em que você é administrador ou tem a permissão de gerenciar.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className={outlineButton} type="button" onClick={onLogout}>Sair</button>
        </div>
      </div>
      {guilds.length === 0 ? (
        <Message title="Nenhum servidor para configurar">
          Você precisa ser administrador, ou ter a permissão “Gerenciar servidor”, em um servidor. Peça a quem administra.
        </Message>
      ) : (
        <ul className={grid}>
          {ordered.map((guild) => (guild.botIn === false ? <InviteCard key={guild.id} guild={guild} /> : <ManageCard key={guild.id} guild={guild} />))}
        </ul>
      )}
    </main>
  );
}

export { DashboardPage };
