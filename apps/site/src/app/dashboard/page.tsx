'use client';

import { useEffect } from 'react';
import type { Session } from '../../lib/session';
import { card, primaryButton, outlineButton, memberFormat, GuildIcon, StatusSkeleton, Message } from './ui';

type DashboardPageProps = {
  session: Session | null;
  failed: boolean;
  onLogout: () => void;
};

function DashboardPage({ session, failed, onLogout }: DashboardPageProps) {
  useEffect(() => {
    if (session && !session.authenticated) location.replace('/login');
  }, [session]);

  const guilds = session?.guilds ?? [];

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
              <a className={`${card} flex min-h-[72px] w-full items-center gap-4 px-5 py-3 text-left text-text hover:border-text`} href={`/dashboard/${item.id}`}>
                <GuildIcon guild={item} size="lg" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-base font-medium">{item.name}</span>
                  {item.members !== null ? <span className="text-[13px] text-muted">{memberFormat.format(item.members)} membros</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export { DashboardPage };
