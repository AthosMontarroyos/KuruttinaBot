'use client';

import { useCallback, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import type { GuildListError, GuildListResult } from '../../lib/guild-api';
import { sessionExpired } from '../../lib/error-messages';

type ResourceSelectProps<Item> = {
  guildId: string;
  /** ID escolhido; vazio quando nenhum. */
  value: string;
  onChange: (id: string) => void;
  label: string;
  disabled?: boolean;
  /** Leitura da lista. Precisa ser uma função estável (declarada fora do componente), senão a lista recarrega a cada render. */
  load: (guildId: string) => Promise<GuildListResult<Item>>;
  /** As `<option>`/`<optgroup>` da lista carregada. */
  renderOptions: (items: Item[]) => ReactNode;
  /** Estilo do campo fechado para o item escolhido (cargo colorido); sem ele o campo usa o visual padrão. */
  valueStyle?: (items: Item[], value: string) => CSSProperties | undefined;
  /** Primeira opção, sem valor: "Escolha um canal". */
  placeholder: string;
  /** Texto quando o servidor não tem nenhum item. */
  emptyMessage: string;
  /** Placeholder do campo de ID usado se a lista não carregar. */
  manualPlaceholder: string;
  loadingLabel: string;
};

const control = 'min-h-11 w-full rounded-[10px] border border-control bg-transparent px-3 text-sm text-text disabled:opacity-60';

function problem(error: GuildListError): string {
  switch (error) {
    case 'bot_not_in_guild': return 'O bot não está neste servidor.';
    case 'unauthenticated': return sessionExpired;
    case 'not_found': return 'Esse servidor não está disponível.';
    default: return 'Não foi possível carregar a lista agora.';
  }
}

/**
 * Base dos seletores (canal, cargo, categoria): carrega a lista sozinha; se ela não puder ser carregada,
 * mostra o motivo, deixa tentar de novo e aceita o ID digitado, para o fluxo não travar.
 */
function ResourceSelect<Item>({ guildId, value, onChange, label, disabled = false, load, renderOptions, valueStyle, placeholder, emptyMessage, manualPlaceholder, loadingLabel }: ResourceSelectProps<Item>) {
  const id = useId();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; items: Item[] } | { status: 'failed'; error: GuildListError }>({ status: 'loading' });

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    const result = await load(guildId);
    setState(result.ok ? { status: 'ready', items: result.items } : { status: 'failed', error: result.error });
  }, [guildId, load]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      {state.status === 'loading' ? (
        <div role="status" aria-label={loadingLabel} className="min-h-11 animate-pulse rounded-[10px] bg-border motion-reduce:animate-none" />
      ) : null}
      {state.status === 'ready' ? (
        state.items.length === 0 ? (
          <p className="text-sm text-muted">{emptyMessage}</p>
        ) : (
          <select id={id} className={control} style={valueStyle?.(state.items, value)} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
            <option className="bg-surface text-text" value="">{placeholder}</option>
            {renderOptions(state.items)}
          </select>
        )
      ) : null}
      {state.status === 'failed' ? (
        <>
          <p role="alert" className="text-sm text-red-600">{problem(state.error)}</p>
          <div className="flex gap-2">
            <input
              id={id}
              className={control}
              type="text"
              inputMode="numeric"
              placeholder={manualPlaceholder}
              value={value}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value.trim())}
            />
            <button type="button" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border border-control bg-transparent px-4 text-sm font-medium text-text hover:bg-surface" onClick={() => void reload()}>Tentar de novo</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export { ResourceSelect, problem as guildListProblem };
export type { ResourceSelectProps };
