import type { Guild } from '../../../../lib/session';
import { card, memberFormat } from '../../ui';

function OverviewView({ guild }: { guild: Guild }) {
  return (
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
  );
}

export { OverviewView };
