import type { ReactNode } from 'react';
import type { Guild } from '../../lib/session';

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

function Message({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-[420px] text-sm leading-6 text-muted">{children}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { card, primaryButton, outlineButton, memberFormat, GuildIcon, Skeleton, Message };
