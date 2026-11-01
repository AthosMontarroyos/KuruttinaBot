'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { type GuildListError, type Role } from '../../lib/guild-api';
import { guildListProblem } from './ResourceSelect';
import { RoleMark } from './RoleMark';
import { listAssignableRoles } from './RoleSelect';

type RoleMultiPickerProps = {
  /** Servidor cujos cargos são listados. */
  guildId: string;
  /** IDs dos cargos escolhidos, na ordem em que foram adicionados. */
  value: string[];
  onChange: (roleIds: string[]) => void;
  /** Elemento sobre o qual o painel abre (a opção clicada). Clicar nele não fecha o painel: quem o abriu decide. */
  anchor: HTMLElement;
  onClose: () => void;
  /** Título do painel; padrão "Cargos". */
  label?: string;
  /** Limite de cargos escolhidos; sem ele a lista é livre. */
  max?: number;
  disabled?: boolean;
};

type RolesState = { status: 'loading' } | { status: 'ready'; roles: Role[] } | { status: 'failed'; error: GuildListError };

const PANEL_WIDTH = 360;
const PANEL_GAP = 6;
const PANEL_MARGIN = 12;
const PANEL_MAX_HEIGHT = 420;
const chipButton = 'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-600 disabled:opacity-50';

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Posição do painel: fixo na tela, acima do elemento quando cabe (senão abaixo), sem mexer no layout. */
function panelPosition(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * PANEL_MARGIN);
  const left = Math.max(PANEL_MARGIN, Math.min(rect.left, window.innerWidth - width - PANEL_MARGIN));
  const above = rect.top - PANEL_GAP - PANEL_MARGIN;
  const below = window.innerHeight - rect.bottom - PANEL_GAP - PANEL_MARGIN;
  if (above >= below) return { left, width, bottom: window.innerHeight - rect.top + PANEL_GAP, maxHeight: Math.min(above, PANEL_MAX_HEIGHT) };
  return { left, width, top: rect.bottom + PANEL_GAP, maxHeight: Math.min(below, PANEL_MAX_HEIGHT) };
}

/**
 * Painel flutuante para escolher vários cargos de um servidor: os cargos viram chips com o ponto da cor do cargo e o
 * botão + abre a lista dos que faltam, com busca (sem o `@everyone` nem cargos de bots). Abre sobre `anchor` e não
 * empurra o formulário. Quem o usa o monta quando o painel deve estar aberto e o desmonta em `onClose`.
 *
 *     {open ? <RoleMultiPicker guildId={guildId} value={roleIds} onChange={setRoleIds} anchor={chip} onClose={close} max={25} /> : null}
 */
function RoleMultiPicker({ guildId, value, onChange, anchor, onClose, label = 'Cargos', max, disabled = false }: RoleMultiPickerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RolesState>({ status: 'loading' });
  const [picking, setPicking] = useState(value.length === 0);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<CSSProperties>({});

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    const result = await listAssignableRoles(guildId);
    setState(result.ok ? { status: 'ready', roles: result.items } : { status: 'failed', error: result.error });
  }, [guildId]);

  useEffect(() => { void reload(); }, [reload]);

  useLayoutEffect(() => {
    const place = () => setPosition(panelPosition(anchor));
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, picking, value.length]);

  // Captura antes do Esc do modal: fecha só o painel.
  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchor.contains(target)) onClose();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      (anchor.querySelector<HTMLElement>('button') ?? anchor).focus();
    }
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [anchor, onClose]);

  const roles = state.status === 'ready' ? state.roles : [];
  const rolesById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
  const full = max !== undefined && value.length >= max;
  const needle = query.trim().toLocaleLowerCase();
  const available = roles.filter((role) => !value.includes(role.id) && role.name.toLocaleLowerCase().includes(needle));

  function add(roleId: string) {
    if (full || value.includes(roleId)) return;
    onChange([...value, roleId]);
    if (max !== undefined && value.length + 1 >= max) setPicking(false);
  }

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      style={position}
      className="fixed z-[60] flex flex-col gap-2 overflow-y-auto rounded-[10px] border border-control bg-surface p-2.5 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        {max !== undefined ? <span className="text-xs text-muted">{`${value.length}/${max}`}</span> : null}
      </div>

      {state.status === 'loading' ? <div role="status" aria-label="Carregando cargos" className="h-8 animate-pulse rounded-[10px] bg-border motion-reduce:animate-none" /> : null}

      {state.status === 'failed' ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-red-600">{guildListProblem(state.error)}</p>
          <button type="button" className="inline-flex min-h-8 items-center justify-center rounded-[10px] border border-control bg-transparent px-3 text-sm font-medium text-text hover:bg-border" onClick={() => void reload()}>Tentar de novo</button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <ul className="flex flex-wrap items-center gap-2">
            {value.map((roleId) => {
              const role = rolesById.get(roleId);
              const name = role ? role.name : 'Cargo removido';
              return (
                <li key={roleId} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-control py-0.5 pl-2.5 pr-1 text-sm font-medium">
                  <RoleMark role={role} />
                  <span className="truncate">{name}</span>
                  <button type="button" className={chipButton} aria-label={`Remover ${name}`} title="Remover" disabled={disabled} onClick={() => onChange(value.filter((id) => id !== roleId))}>
                    <CloseIcon />
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-full border border-control bg-transparent text-text hover:bg-border disabled:opacity-50"
                aria-label="Adicionar cargo"
                title="Adicionar cargo"
                aria-pressed={picking}
                disabled={disabled || full}
                onClick={() => { setQuery(''); setPicking((current) => !current); }}
              >
                <PlusIcon />
              </button>
            </li>
          </ul>

          {picking ? (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              <input
                type="search"
                autoFocus
                aria-label="Buscar cargo"
                placeholder="Buscar cargo"
                className="min-h-9 w-full rounded-lg border border-control bg-transparent px-3 text-sm text-text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {available.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted">
                  {roles.length === 0 ? 'Este servidor não tem cargos que possam ser dados.' : needle === '' ? 'Todos os cargos já foram adicionados.' : 'Nenhum cargo encontrado.'}
                </p>
              ) : (
                <ul className="flex max-h-52 flex-col overflow-y-auto">
                  {available.map((role) => (
                    <li key={role.id}>
                      <button type="button" className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-text hover:bg-border disabled:opacity-50" disabled={disabled} onClick={() => add(role.id)}>
                        <RoleMark role={role} />
                        <span className="truncate">{role.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export { RoleMultiPicker };
export type { RoleMultiPickerProps };
