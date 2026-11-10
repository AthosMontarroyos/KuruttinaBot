import { useEffect, useState } from 'react';
import type { Guild } from '../../../../lib/session';
import { listCategories, listChannels, listRoles, listVoiceChannels } from '../../../../lib/guild-api';
import { memberFormat } from '../../ui';

const displayClass = "font-display font-medium tracking-[-0.04em] [font-variation-settings:'SOFT'_100,'opsz'_144]";

type Counts = { roles: number | null; categories: number | null; channels: number | null; voice: number | null };
type Period = 7 | 30 | 90;

const periods: Period[] = [7, 30, 90];

/** Cada célula: divisórias finas entre colunas no celular (2 colunas) e no desktop (5 colunas). */
const numberCells: { key: 'roles' | 'categories' | 'members' | 'channels' | 'voice'; label: string; className: string }[] = [
  { key: 'roles', label: 'Cargos', className: '' },
  { key: 'categories', label: 'Categorias', className: 'border-l pl-4 min-[701px]:pl-7' },
  { key: 'members', label: 'Membros', className: 'max-[700px]:border-t min-[701px]:border-l min-[701px]:pl-7' },
  { key: 'channels', label: 'Canais de texto', className: 'border-l pl-4 min-[701px]:pl-7 max-[700px]:border-t' },
  { key: 'voice', label: 'Canais de voz', className: 'max-[700px]:col-span-2 max-[700px]:border-t min-[701px]:border-l min-[701px]:pl-7' },
];

function initials(name: string): string {
  return name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => [...part][0] ?? '').join('').toUpperCase();
}

function OverviewView({ guild }: { guild: Guild }) {
  const [counts, setCounts] = useState<{ guildId: string; values: Counts } | null>(null);
  const [copied, setCopied] = useState(false);
  const [period, setPeriod] = useState<Period>(7);

  useEffect(() => {
    let active = true;
    const guildId = guild.id;
    void Promise.all([listRoles(guildId), listCategories(guildId), listChannels(guildId), listVoiceChannels(guildId)]).then(
      ([roles, categories, channels, voice]) => {
        if (!active) return;
        setCounts({
          guildId,
          values: {
            roles: roles.ok ? roles.items.length : null,
            categories: categories.ok ? categories.items.length : null,
            channels: channels.ok ? channels.items.length : null,
            voice: voice.ok ? voice.items.length : null,
          },
        });
      },
    );
    return () => {
      active = false;
    };
  }, [guild.id]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function copyId() {
    const write = navigator.clipboard?.writeText(guild.id);
    if (!write) return;
    write.then(
      () => setCopied(true),
      () => {},
    );
  }

  const current = counts?.guildId === guild.id ? counts.values : null;

  function numberText(key: keyof Counts | 'members'): string {
    if (key === 'members') return guild.members !== null ? memberFormat.format(guild.members) : '—';
    const value = current?.[key];
    return value === null || value === undefined ? '—' : String(value);
  }

  return (
    <div className="flex flex-col gap-7 min-[701px]:gap-9">
      <h1 className={`${displayClass} text-[44px] leading-none min-[701px]:text-[64px]`}>Visão geral</h1>

      <div className="flex items-center gap-4 min-[701px]:gap-6">
        {guild.iconUrl ? (
          <img className="size-[72px] shrink-0 rounded-full object-cover min-[701px]:size-24" src={guild.iconUrl} alt="" width={96} height={96} />
        ) : (
          <span aria-hidden="true" className="flex size-[72px] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[30px] font-semibold text-muted min-[701px]:size-24 min-[701px]:text-[40px]">
            {initials(guild.name)}
          </span>
        )}
        <div className="flex min-w-0 flex-col items-start gap-1">
          <h2 className={`${displayClass} text-[30px] leading-[1.05] text-text min-[701px]:text-[44px]`}>{guild.name}</h2>
          <span className="font-mono text-xs text-subtle break-all">{guild.id}</span>
          <button
            className="-ml-3 inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface hover:text-text"
            type="button"
            aria-label="Copiar o ID do servidor"
            onClick={copyId}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 9h11v11H9zM5 15V4h11" />
            </svg>
            {copied ? 'Copiado' : 'Copiar ID'}
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-y border-border min-[701px]:grid-cols-5">
        {numberCells.map((cell) => (
          <div key={cell.key} className={`min-w-0 border-border py-[18px] min-[701px]:py-7 ${cell.className}`}>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{cell.label}</dt>
            <dd className={`mt-2 ${displayClass} text-[44px] leading-none min-[701px]:text-[56px]`}>{numberText(cell.key)}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Entradas e saídas" className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[22px] font-semibold">Entradas e saídas</h2>
            <div className="flex items-center gap-5 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true" className="text-text">
                  <line x1="0" y1="4" x2="28" y2="4" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
                </svg>
                Entradas
              </span>
              <span className="inline-flex items-center gap-2">
                <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true" className="text-muted">
                  <line x1="0" y1="4" x2="28" y2="4" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="5 4" />
                </svg>
                Saídas
              </span>
            </div>
          </div>
          <div role="group" aria-label="Período" className="flex gap-1">
            {periods.map((option) => (
              <button
                key={option}
                className={`min-h-9 rounded-lg px-3.5 text-sm font-medium ${period === option ? 'bg-surface font-semibold text-text' : 'text-muted hover:text-text'}`}
                type="button"
                aria-pressed={period === option}
                onClick={() => setPeriod(option)}
              >
                {option} dias
              </button>
            ))}
          </div>
        </div>

        <div role="img" aria-label="Gráfico de entradas e saídas do servidor, ainda sem dados" className="relative h-[220px] overflow-hidden rounded-xl border border-border min-[701px]:h-[320px]">
          <svg viewBox="0 0 800 280" preserveAspectRatio="none" fill="none" strokeWidth={1} aria-hidden="true" className="absolute inset-0 size-full">
            {[20, 80, 140, 200].map((y) => (
              <line key={y} x1="0" y1={y} x2="800" y2={y} vectorEffect="non-scaling-stroke" className="stroke-border" />
            ))}
            <line x1="0" y1="260" x2="800" y2="260" vectorEffect="non-scaling-stroke" className="stroke-control" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[15px] leading-[1.45] text-muted">
            <span className="rounded-lg bg-background px-3.5 py-1.5">Os dados de entrada e saída do servidor aparecerão aqui.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export { OverviewView };
