'use client';

import { useEffect } from 'react';
import { ArrowRightIcon, PlusIcon } from '../../components/icons';
import type { Guild, Session } from '../../lib/session';
import { primaryButton, memberFormat, StatusSkeleton, Message } from './ui';

type DashboardPageProps = {
  session: Session | null;
  failed: boolean;
  onLogout: () => void;
};

const wrapper = 'mx-auto flex w-full max-w-[760px] min-[1101px]:max-w-[clamp(760px,52vw,980px)] flex-col gap-10 px-5 pt-7 pb-8 min-[701px]:w-[90%] min-[701px]:pt-14 min-[701px]:pb-16';
const list = 'm-0 -mx-3 list-none border-b border-border p-0';
const sectionLabel = 'm-0 text-xs font-semibold uppercase tracking-[0.14em] text-subtle';
const row = 'flex min-h-[76px] items-center gap-4 px-3';

function initials(name: string): string {
  return name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => [...part][0] ?? '').join('').toUpperCase();
}

/** Avatar redondo da linha: o ícone do servidor ou, sem ele, a inicial do nome. */
function Avatar({ guild, dim = false }: { guild: Guild; dim?: boolean }) {
  const size = `size-10 min-[701px]:size-11 shrink-0 rounded-full ${dim ? 'opacity-70' : ''}`;
  return guild.iconUrl ? (
    <img className={`${size} object-cover`} src={guild.iconUrl} alt="" width={64} height={64} />
  ) : (
    <span aria-hidden="true" className={`${size} flex items-center justify-center border border-border bg-surface text-[17px] font-semibold text-muted`}>
      {initials(guild.name)}
    </span>
  );
}

/** Nome e contagem de membros; a contagem só aparece quando o servidor a informa. */
function GuildText({ guild, muted = false }: { guild: Guild; muted?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={`truncate text-[18px] font-semibold ${muted ? 'text-muted' : ''}`}>{guild.name}</span>
      {guild.members !== null ? <span className="text-sm text-muted">{`${memberFormat.format(guild.members)} membros`}</span> : null}
    </span>
  );
}

/** Servidor com a Kuruttina: a linha inteira leva ao painel. */
function ManageRow({ guild }: { guild: Guild }) {
  return (
    <li className="border-t border-border">
      <a
        className={`group ${row} text-text transition-colors hover:bg-surface`}
        href={`/dashboard/${guild.id}`}
        aria-label={`Abrir o painel de ${guild.name}`}
      >
        <Avatar guild={guild} />
        <GuildText guild={guild} />
        <span className="flex shrink-0 items-center gap-2 text-[15px] font-semibold text-muted transition-colors group-hover:text-text">
          <span className="hidden min-[701px]:inline">Abrir painel</span>
          <ArrowRightIcon className="size-[18px] transition-transform group-hover:translate-x-[3px] motion-reduce:transition-none" />
        </span>
      </a>
    </li>
  );
}

/** Servidor onde a pessoa administra, mas a Kuruttina ainda não está: o botão abre o convite já apontado para ele. */
function InviteRow({ guild }: { guild: Guild }) {
  return (
    <li className="border-t border-border">
      <div className={row}>
        <Avatar guild={guild} dim />
        <GuildText guild={guild} muted />
        {guild.inviteUrl ? (
          <a
            className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[6px] border border-text px-[18px] text-[15px] font-semibold text-text hover:bg-surface"
            href={guild.inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Adicionar a Kuruttina ao servidor ${guild.name}`}
          >
            <PlusIcon className="size-[18px]" />
            <span className="hidden min-[701px]:inline">Adicionar a Kuruttina</span>
            <span className="min-[701px]:hidden">Adicionar</span>
          </a>
        ) : (
          <span className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[6px] border border-border px-[18px] text-[15px] font-semibold text-muted">
            Convite indisponível
          </span>
        )}
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
  // `botIn === false` é a única certeza de que o bot não está; sem essa informação o servidor entra em "Com a Kuruttina".
  const withBot = guilds.filter((guild) => guild.botIn !== false);
  const withoutBot = guilds.filter((guild) => guild.botIn === false);

  if (failed) {
    return (
      <main id="conteudo" className={wrapper}>
        <Message title="Painel indisponível" action={<button className={primaryButton} type="button" onClick={() => location.reload()}>Tentar de novo</button>}>
          Não foi possível falar com o servidor agora.
        </Message>
      </main>
    );
  }

  if (!session?.authenticated) {
    return (
      <main id="conteudo" className={wrapper}>
        <StatusSkeleton label="Carregando" rows={['h-9 w-60', 'h-[72px]', 'h-[72px]']} />
      </main>
    );
  }

  const logout = (className: string) => (
    <button className={className} type="button" onClick={onLogout}>Sair</button>
  );

  return (
    <main id="conteudo" className={wrapper}>
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-[14px]">
          <h1 className="m-0 font-display text-[40px] font-medium leading-none tracking-[-0.04em] text-text [font-variation-settings:'SOFT'_100,'opsz'_144] min-[701px]:text-[clamp(64px,4.4vw,88px)]">
            Escolha um servidor
          </h1>
          <p className="m-0 max-w-[52ch] text-base leading-[1.45] text-muted min-[701px]:text-[18px]">
            Aparecem os servidores em que você é administrador ou tem a permissão de gerenciar.
          </p>
        </div>
        {logout('hidden min-h-11 shrink-0 bg-transparent px-1 text-[15px] font-semibold text-muted hover:text-text min-[701px]:inline-flex min-[701px]:items-center')}
      </div>

      {guilds.length === 0 ? (
        <Message title="Nenhum servidor para configurar">
          Você precisa ser administrador, ou ter a permissão “Gerenciar servidor”, em um servidor. Peça a quem administra.
        </Message>
      ) : (
        <>
          {withBot.length > 0 ? (
            <section aria-label="Com a Kuruttina" className="flex flex-col gap-[14px]">
              <h2 className={sectionLabel}>Com a Kuruttina</h2>
              <ul className={list}>
                {withBot.map((guild) => <ManageRow key={guild.id} guild={guild} />)}
              </ul>
            </section>
          ) : null}
          {withoutBot.length > 0 ? (
            <section aria-label="Sem a Kuruttina" className="flex flex-col gap-[14px]">
              <h2 className={sectionLabel}>Sem a Kuruttina</h2>
              <ul className={list}>
                {withoutBot.map((guild) => <InviteRow key={guild.id} guild={guild} />)}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {logout('min-h-11 self-start bg-transparent px-1 text-[15px] font-semibold text-muted hover:text-text min-[701px]:hidden')}
    </main>
  );
}

export { DashboardPage };
