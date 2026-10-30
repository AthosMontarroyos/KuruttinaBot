'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { getSelectConfig, listCustomActions, type CustomAction } from '../../app/dashboard/[serverId]/custom-actions/custom-actions-api';
import { useGuildId } from '../../lib/guild-context';
import { EmojiPicker, type EmojiValue } from '../selectors/EmojiPicker';
import { LIMITS, newOptionValue, record, text } from './message-model';

type Row = Record<string, unknown>;
type Option = Record<string, unknown>;
/** Popover aberto: o do menu, o de uma opção (pelo índice) ou o seletor de emoji de uma opção. Só um por vez. */
type Open = { type: 'menu' } | { type: 'option'; index: number } | { type: 'emoji'; index: number } | null;
type ComponentList = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; items: CustomAction[] } | { status: 'error' };
type ActionOption = { key: string; label: string };
type ActionLoad = { status: 'loading' } | { status: 'ready'; options: ActionOption[] } | { status: 'error'; missing: boolean };

const addButtonClass = 'rounded bg-[#383a40] px-3 py-1 text-sm font-medium text-[#dbdee1] hover:bg-[#4e5058] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#383a40] disabled:hover:text-[#dbdee1]';
const iconButtonClass = 'flex size-6 shrink-0 items-center justify-center rounded text-[#b5bac1] hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#b5bac1]';
const arrowButtonClass = 'flex h-4 w-5 items-center justify-center rounded text-[10px] text-[#b5bac1] hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#b5bac1]';
const fieldInput = 'min-h-8 w-full rounded bg-[#1e1f22] px-2 text-sm text-[#dbdee1] outline outline-1 focus:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-60';
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-wide text-[#b5bac1]';
const popoverClass = 'absolute left-0 top-full z-10 mt-2 flex w-[240px] flex-col gap-3 rounded-[8px] border border-white/10 bg-[#111214] p-3 text-left text-[#dbdee1] shadow-2xl';

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** Ação (Component de menu) do menu: `undefined` quando não há ou quando o valor não é um id inteiro. */
function componentOf(menu: Row): number | undefined {
  const value = menu.component;
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

/** Põe o campo no objeto, ou tira a chave quando o valor é `undefined` ou `''`. */
function withField(source: Row, key: string, value: unknown): Row {
  const next: Row = { ...source };
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  return next;
}

/** Emoji da opção; `null` quando não há. */
function emojiOf(option: Option): EmojiValue | null {
  const data = record(option.emoji);
  const name = text(data.name);
  if (name === '') return null;
  const id = text(data.id);
  return { name, ...(id !== '' ? { id } : {}), ...(data.animated === true ? { animated: true } : {}) };
}

/** Põe o emoji na opção, ou tira a chave `emoji` quando `null`. */
function withEmoji(option: Option, emoji: EmojiValue | null): Option {
  return withField(option, 'emoji', emoji ?? undefined);
}

/** Lê a contagem digitada e limita ao intervalo; `undefined` quando o campo está vazio. */
function countOf(value: string, min: number, max: number): number | undefined {
  if (value.trim() === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

type SelectRowEditorProps = {
  /** Linha de menu de seleção, do jeito que está no modelo (`{ kind: 'select', menu }`). */
  row: unknown;
  onChange: (row: Row) => void;
};

/**
 * Cartão de um menu de seleção: placeholder no topo (com engrenagem do menu e X), a lista de opções
 * (reordenar, emoji, rótulo, descrição, engrenagem e remover) e "+ Adicionar opção".
 * Renderizado dentro do cabeçalho da linha. A lista de Components de menu é carregada na primeira abertura
 * do popover do menu; a de cada Component escolhido, na primeira abertura do popover de uma opção.
 */
export function SelectRowEditor({ row, onChange }: SelectRowEditorProps) {
  const id = useId();
  const guildId = useGuildId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open>(null);
  const [components, setComponents] = useState<ComponentList>({ status: 'idle' });
  const [actions, setActions] = useState<Record<string, ActionLoad>>({});
  const listFor = useRef<string | null>(null);
  const requested = useRef(new Set<string>());

  const menu: Row = record(record(row).menu);
  const options: unknown[] = Array.isArray(menu.options) ? menu.options : [];
  const component = componentOf(menu);
  const full = options.length >= LIMITS.selectOptions;
  const openKey = open === null || open.type === 'emoji' ? null : open.type === 'menu' ? 'menu' : `option-${open.index}`;
  const actionKey = guildId !== null && component !== undefined ? `${guildId}:${component}` : null;
  const actionLoad = actionKey === null ? undefined : actions[actionKey];

  useEffect(() => {
    if (open?.type !== 'menu' || guildId === null || listFor.current === guildId) return;
    listFor.current = guildId;
    setComponents({ status: 'loading' });
    listCustomActions(guildId, 'selects').then((result) => {
      if (result.ok) {
        if (listFor.current === guildId) setComponents({ status: 'ready', items: result.data.items });
      } else {
        listFor.current = null;
        setComponents({ status: 'error' });
      }
    });
  }, [open, guildId]);

  useEffect(() => {
    if (open?.type !== 'option' || guildId === null || component === undefined) return;
    const key = `${guildId}:${component}`;
    if (requested.current.has(key)) return;
    requested.current.add(key);
    setActions((current) => ({ ...current, [key]: { status: 'loading' } }));
    getSelectConfig(guildId, component).then((result) => {
      if (result.ok) {
        const loaded = result.data.options.map((item) => ({ key: item.key, label: item.label }));
        setActions((current) => ({ ...current, [key]: { status: 'ready', options: loaded } }));
      } else {
        requested.current.delete(key);
        setActions((current) => ({ ...current, [key]: { status: 'error', missing: result.error === 'not_found' } }));
      }
    });
  }, [open, guildId, component]);

  useEffect(() => {
    if (openKey === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const holder = event.target instanceof Element ? event.target.closest('[data-popover-key]') : null;
      if (holder?.getAttribute('data-popover-key') !== openKey) setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openKey]);

  const setMenu = (next: Row) => onChange({ ...record(row), menu: next });
  const setOptions = (next: unknown[]) => setMenu({ ...menu, options: next });
  const patchOption = (index: number, next: Option) => setOptions(options.map((item, itemIndex) => (itemIndex === index ? next : item)));

  const add = () => {
    const taken = options.map((item) => text(record(item).value));
    setOptions([...options, { label: `Opção ${options.length + 1}`, value: newOptionValue(taken) }]);
  };
  const remove = (index: number) => {
    setOpen(null);
    setOptions(options.filter((_, itemIndex) => itemIndex !== index));
  };
  const move = (index: number, step: -1 | 1) => {
    const target = index + step;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    [next[index], next[target]] = [next[target], next[index]];
    setOpen(null);
    setOptions(next);
  };

  /** Trocar ou limpar a ação do menu desfaz os vínculos de todas as opções. */
  const setMenuAction = (value: number | undefined) => {
    setMenu({ ...withField(menu, 'component', value), options: options.map((item) => withField(record(item), 'componentOption', undefined)) });
  };
  const setCount = (key: 'minValues' | 'maxValues', value: string, min: number, max: number) => {
    setMenu(withField(menu, key, countOf(value, min, max)));
  };

  const menuStatus: 'no-guild' | 'loading' | 'error' | 'ready' = guildId === null ? 'no-guild' : components.status === 'ready' ? 'ready' : components.status === 'error' ? 'error' : 'loading';
  const menuItems = components.status === 'ready' ? components.items : [];
  const menuMissing = component !== undefined && !menuItems.some((item) => item.id === component);
  const menuHint = menuStatus === 'no-guild'
    ? 'Servidor não identificado.'
    : menuStatus === 'loading'
      ? 'Carregando Components…'
      : menuStatus === 'error'
        ? 'Não foi possível carregar os Components.'
        : menuItems.length === 0
          ? 'Nenhum Component de menu criado ainda. Crie em Components.'
          : null;

  const actionStatus: 'no-menu-action' | 'loading' | 'error' | 'ready' = component === undefined
    ? 'no-menu-action'
    : actionLoad?.status === 'ready' ? 'ready' : actionLoad?.status === 'error' ? 'error' : 'loading';
  const actionOptions = actionLoad?.status === 'ready' ? actionLoad.options : [];
  const actionHint = actionStatus === 'no-menu-action'
    ? 'Escolha a ação do menu primeiro.'
    : actionStatus === 'loading'
      ? 'Carregando ações…'
      : actionStatus === 'error'
        ? (actionLoad?.status === 'error' && actionLoad.missing ? 'Esta ação do menu não existe mais.' : 'Não foi possível carregar as ações do menu.')
        : actionOptions.length === 0
          ? 'Esta ação não tem opções.'
          : null;

  return (
    <div
      ref={rootRef}
      className="flex w-full flex-col gap-3 rounded-[8px] bg-[#2b2d31] p-3"
      onKeyDown={(event) => {
        if (openKey !== null && event.key === 'Escape') {
          event.stopPropagation();
          setOpen(null);
          rootRef.current?.querySelector<HTMLButtonElement>(`[data-gear-key="${openKey}"]`)?.focus();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <div data-popover-key="menu" className="relative">
          <button
            type="button"
            data-gear-key="menu"
            aria-label="Configurar menu"
            aria-haspopup="dialog"
            aria-expanded={open?.type === 'menu'}
            aria-controls={open?.type === 'menu' ? `${id}-menu` : undefined}
            className={iconButtonClass}
            onClick={() => setOpen(open?.type === 'menu' ? null : { type: 'menu' })}
          >
            <GearIcon />
          </button>

          {open?.type === 'menu' ? (
            <div id={`${id}-menu`} role="dialog" aria-label="Configurar menu" className={popoverClass}>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label htmlFor={`${id}-min`} className={fieldLabel}>Seleções mín.</label>
                  <input
                    id={`${id}-min`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={LIMITS.selectOptions}
                    value={typeof menu.minValues === 'number' ? menu.minValues : ''}
                    className={`${fieldInput} outline-[#4e5058]`}
                    onChange={(event) => setCount('minValues', event.target.value, 0, LIMITS.selectOptions)}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label htmlFor={`${id}-max`} className={fieldLabel}>Seleções máx.</label>
                  <input
                    id={`${id}-max`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={LIMITS.selectOptions}
                    value={typeof menu.maxValues === 'number' ? menu.maxValues : ''}
                    className={`${fieldInput} outline-[#4e5058]`}
                    onChange={(event) => setCount('maxValues', event.target.value, 1, LIMITS.selectOptions)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <label htmlFor={`${id}-acao-menu`} className={fieldLabel}>Ação</label>
                <select
                  id={`${id}-acao-menu`}
                  disabled={menuStatus !== 'ready'}
                  aria-describedby={menuHint === null ? undefined : `${id}-acao-menu-dica`}
                  className={`${fieldInput} outline-[#4e5058]`}
                  value={component === undefined ? '' : String(component)}
                  onChange={(event) => setMenuAction(event.target.value === '' ? undefined : Number(event.target.value))}
                >
                  <option value="">Sem ação</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                  {component !== undefined && menuMissing ? (
                    <option value={component}>{menuStatus === 'ready' ? `Component removido (id ${component})` : `Component (id ${component})`}</option>
                  ) : null}
                </select>
                {menuHint === null ? null : (
                  <p id={`${id}-acao-menu-dica`} role={menuStatus === 'error' ? 'alert' : undefined} className={`text-xs ${menuStatus === 'error' ? 'text-red-400' : 'text-[#949ba4]'}`}>
                    {menuHint}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <input
          type="text"
          aria-label="Texto do menu"
          placeholder="Texto do menu (opcional)"
          value={text(menu.placeholder)}
          className="min-w-0 flex-1 rounded bg-[#1e1f22] px-2 py-1.5 text-sm text-[#dbdee1] placeholder:text-[#949ba4] focus:outline focus:outline-1 focus:outline-[#5865f2]"
          onChange={(event) => setMenu(withField(menu, 'placeholder', event.target.value))}
        />
        <button
          type="button"
          aria-label="Remover menu"
          title="Remover menu (a linha fica vazia)"
          className={iconButtonClass}
          onClick={() => onChange({ kind: 'pending' })}
        >
          <CloseIcon />
        </button>
      </div>

      {options.length === 0 ? null : (
        <ol aria-label="Opções do menu" className="flex flex-col gap-2">
          {options.map((item, index) => {
            const option = record(item);
            const number = index + 1;
            const optionKey = `option-${index}`;
            const optionOpen = open?.type === 'option' && open.index === index;
            const emojiOpen = open?.type === 'emoji' && open.index === index;
            const storedKey = text(option.componentOption);
            const found = actionOptions.some((entry) => entry.key === storedKey);
            const missingLabel = actionStatus === 'error' ? 'Ação indisponível' : actionStatus === 'loading' ? 'Carregando…' : 'Opção removida';
            const optionAcaoId = `${id}-opcao-${index}-acao`;

            return (
              <li key={text(option.value) || `index-${index}`} className="flex items-start gap-2 rounded bg-[#1e1f22] p-2">
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    aria-label={`Mover opção ${number} para cima`}
                    disabled={index === 0}
                    className={arrowButtonClass}
                    onClick={() => move(index, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover opção ${number} para baixo`}
                    disabled={index === options.length - 1}
                    className={arrowButtonClass}
                    onClick={() => move(index, 1)}
                  >
                    ▼
                  </button>
                </div>

                <div data-popover-key={optionKey} className="relative mt-1">
                  <button
                    type="button"
                    data-gear-key={optionKey}
                    aria-label={`Configurar opção ${number}`}
                    aria-haspopup="dialog"
                    aria-expanded={optionOpen}
                    aria-controls={optionOpen ? `${id}-opcao-${index}` : undefined}
                    className={iconButtonClass}
                    onClick={() => setOpen(optionOpen ? null : { type: 'option', index })}
                  >
                    <GearIcon />
                  </button>

                  {optionOpen ? (
                    <div id={`${id}-opcao-${index}`} role="dialog" aria-label={`Configurar opção ${number}`} className={popoverClass}>
                      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#b5bac1]">
                        <input
                          type="checkbox"
                          checked={option.default === true}
                          className="size-4 accent-[#5865f2]"
                          onChange={(event) => patchOption(index, withField(option, 'default', event.target.checked ? true : undefined))}
                        />
                        Selecionada por padrão
                      </label>

                      <div className="flex flex-col gap-0.5">
                        <label htmlFor={optionAcaoId} className={fieldLabel}>Ação</label>
                        <select
                          id={optionAcaoId}
                          disabled={actionStatus !== 'ready'}
                          aria-describedby={actionHint === null ? undefined : `${optionAcaoId}-dica`}
                          className={`${fieldInput} outline-[#4e5058]`}
                          value={storedKey}
                          onChange={(event) => patchOption(index, withField(option, 'componentOption', event.target.value === '' ? undefined : event.target.value))}
                        >
                          <option value="">Sem ação</option>
                          {actionOptions.map((entry) => (
                            <option key={entry.key} value={entry.key}>{entry.label}</option>
                          ))}
                          {storedKey !== '' && !found ? <option value={storedKey}>{missingLabel}</option> : null}
                        </select>
                        {actionHint === null ? null : (
                          <p id={`${optionAcaoId}-dica`} role={actionStatus === 'error' ? 'alert' : undefined} className={`text-xs ${actionStatus === 'error' ? 'text-red-400' : 'text-[#949ba4]'}`}>
                            {actionHint}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <EmojiPicker
                  guildId={guildId}
                  value={emojiOf(option)}
                  disabled={guildId === null}
                  open={emojiOpen}
                  onOpenChange={(next) => setOpen(next ? { type: 'emoji', index } : null)}
                  onChange={(next) => patchOption(index, withEmoji(option, next))}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <input
                    type="text"
                    aria-label={`Rótulo da opção ${number}`}
                    placeholder="Rótulo"
                    maxLength={LIMITS.selectOptionText}
                    value={text(option.label)}
                    className="min-w-0 border-0 bg-transparent p-0 text-sm font-semibold text-white placeholder:text-white/60 focus:outline-none"
                    onChange={(event) => patchOption(index, { ...option, label: event.target.value })}
                  />
                  <input
                    type="text"
                    aria-label={`Descrição da opção ${number}`}
                    placeholder="Descrição (opcional)"
                    maxLength={LIMITS.selectOptionText}
                    value={text(option.description)}
                    className="min-w-0 border-0 bg-transparent p-0 text-xs text-[#b5bac1] placeholder:text-[#949ba4] focus:outline-none"
                    onChange={(event) => patchOption(index, withField(option, 'description', event.target.value))}
                  />
                </div>

                <button
                  type="button"
                  aria-label={`Remover opção ${number}`}
                  className={iconButtonClass}
                  onClick={() => remove(index)}
                >
                  <CloseIcon />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div>
        <button
          type="button"
          disabled={full}
          title={full ? `Máximo de ${LIMITS.selectOptions} opções por menu` : undefined}
          className={addButtonClass}
          onClick={add}
        >
          + Adicionar opção
        </button>
      </div>
    </div>
  );
}
