'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { listCustomActions, type CustomAction } from '../../app/dashboard/[serverId]/custom-actions/custom-actions-api';
import { useGuildId } from '../../lib/guild-context';
import { EmojiPicker, type EmojiValue } from '../selectors/EmojiPicker';
import { buttonStyles } from './ComponentsPreview';
import { LIMITS, record, text } from './message-model';

type Button = Record<string, unknown>;
type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger' | 'link';
type ComponentLoad = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; items: CustomAction[] } | { status: 'error' };

const STYLE_OPTIONS: { style: ButtonStyle; label: string }[] = [
  { style: 'primary', label: 'Azul' },
  { style: 'secondary', label: 'Cinza' },
  { style: 'success', label: 'Verde' },
  { style: 'danger', label: 'Vermelho' },
  { style: 'link', label: 'Link' },
];

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

const addButtonClass = 'rounded bg-[#383a40] px-3 py-1 text-sm font-medium text-[#dbdee1] hover:bg-[#4e5058] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#383a40] disabled:hover:text-[#dbdee1]';
const pillClass = 'inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#5865f2]';
const pillIconClass = 'inline-flex size-5 shrink-0 items-center justify-center rounded text-white/80 hover:bg-white/20 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white';
const fieldInput = 'min-h-8 w-full rounded bg-[#1e1f22] px-2 text-sm text-[#dbdee1] outline outline-1 focus:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-60';
const fieldLabel = 'text-[11px] font-semibold uppercase tracking-wide text-[#b5bac1]';

/** Id do botão no Discord: `kt:b:` seguido de 8 caracteres `[a-z0-9]` aleatórios. */
export function newCustomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `kt:b:${Array.from(bytes, (byte) => ID_CHARS.charAt(byte % ID_CHARS.length)).join('')}`;
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Ação (Component) do botão: `undefined` quando não há ou quando o valor não é um id inteiro. */
function componentOf(button: Button): number | undefined {
  const value = button.component;
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function withComponent(button: Button, component: number | undefined): Button {
  const next: Button = { ...button };
  if (component === undefined) delete next.component;
  else next.component = component;
  return next;
}

/** Emoji do botão; `null` quando não há (unicode sem nome ou sem `emoji`). */
function emojiOf(button: Button): EmojiValue | null {
  const data = record(button.emoji);
  const name = text(data.name);
  if (name === '') return null;
  const id = text(data.id);
  return { name, ...(id !== '' ? { id } : {}), ...(data.animated === true ? { animated: true } : {}) };
}

/** Põe o emoji no botão, ou tira a chave `emoji` quando `null`. */
function withEmoji(button: Button, emoji: EmojiValue | null): Button {
  const next: Button = { ...button };
  if (emoji === null) delete next.emoji;
  else next.emoji = emoji;
  return next;
}

/**
 * Troca a cor (ou o Link) de um botão. Link não tem ação nem `customId` e ganha `url` vazia;
 * sair do Link gera um `customId` novo e tira a `url`. Entre cores o `customId` é preservado.
 */
function withStyle(button: Button, style: ButtonStyle): Button {
  const next: Button = { ...button, style };
  if (style === 'link') {
    delete next.component;
    delete next.customId;
    next.url = '';
    return next;
  }
  delete next.url;
  if (button.style === 'link' || text(button.customId) === '') next.customId = newCustomId();
  return next;
}

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

type ButtonRowEditorProps = {
  /** Botões da linha, do jeito que estão no modelo. */
  buttons: unknown[];
  /** Posição do botão com o popover aberto; `null` quando nenhum está aberto. */
  editing: number | null;
  onEditing: (button: number | null) => void;
  onChange: (buttons: unknown[]) => void;
};

/**
 * Botões de uma linha, como pílulas, seguidos do "+ Botão". Renderizado dentro da barra de cabeçalho da linha.
 * A lista de Components é carregada uma vez por linha, no primeiro popover aberto.
 */
export function ButtonRowEditor({ buttons, editing, onEditing, onChange }: ButtonRowEditorProps) {
  const guildId = useGuildId();
  const [components, setComponents] = useState<ComponentLoad>({ status: 'idle' });
  const loadedFor = useRef<string | null>(null);
  const full = buttons.length >= LIMITS.buttonsPerRow;
  const open = editing !== null && editing < buttons.length ? editing : null;

  useEffect(() => {
    if (open === null || guildId === null || loadedFor.current === guildId) return;
    loadedFor.current = guildId;
    setComponents({ status: 'loading' });
    listCustomActions(guildId, 'buttons').then((result) => {
      if (loadedFor.current === guildId) setComponents(result.ok ? { status: 'ready', items: result.data.items } : { status: 'error' });
    });
  }, [open, guildId]);

  const replaceButton = (index: number, next: Button) => onChange(buttons.map((item, itemIndex) => (itemIndex === index ? next : item)));
  const add = () => {
    onChange([...buttons, { style: 'secondary', label: 'Botão', customId: newCustomId() }]);
    onEditing(buttons.length);
  };
  const remove = (index: number) => {
    onChange(buttons.filter((_, itemIndex) => itemIndex !== index));
    onEditing(null);
  };

  return (
    <>
      {buttons.map((item, index) => (
        <ButtonPill
          key={index}
          button={record(item)}
          open={open === index}
          components={components}
          guildId={guildId}
          onOpenChange={(next) => onEditing(next ? index : null)}
          onChange={(next) => replaceButton(index, next)}
          onRemove={() => remove(index)}
        />
      ))}
      <button
        type="button"
        disabled={full}
        title={full ? `Máximo de ${LIMITS.buttonsPerRow} botões por linha` : undefined}
        className={addButtonClass}
        onClick={add}
      >
        + Botão
      </button>
    </>
  );
}

type ButtonPillProps = {
  button: Button;
  open: boolean;
  components: ComponentLoad;
  guildId: string | null;
  onOpenChange: (open: boolean) => void;
  onChange: (next: Button) => void;
  onRemove: () => void;
};

/** Pílula de um botão: engrenagem (abre o popover), emoji, rótulo editável e X para remover. */
function ButtonPill({ button, open, components, guildId, onOpenChange, onChange, onRemove }: ButtonPillProps) {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const style = text(button.style);
  const isLink = style === 'link';
  const label = text(button.label);
  const emoji = emojiOf(button);
  const url = text(button.url);
  const urlInvalid = isLink && url !== '' && !isHttps(url);
  const styleValue = STYLE_OPTIONS.some((option) => option.style === style) ? style : 'secondary';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current !== null && event.target instanceof Node && !wrapperRef.current.contains(event.target)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, onOpenChange]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.stopPropagation();
          onOpenChange(false);
          gearRef.current?.focus();
        }
      }}
    >
      <div className={`${pillClass} ${buttonStyles[style] ?? buttonStyles.secondary}`}>
        <button
          ref={gearRef}
          type="button"
          aria-label="Configurar botão"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-popover` : undefined}
          className={pillIconClass}
          onClick={() => {
            setEmojiOpen(false);
            onOpenChange(!open);
          }}
        >
          <GearIcon />
        </button>
        <EmojiPicker
          guildId={guildId}
          value={emoji}
          disabled={guildId === null}
          open={emojiOpen}
          onOpenChange={(next) => {
            setEmojiOpen(next);
            if (next && open) onOpenChange(false);
          }}
          onChange={(next) => onChange(withEmoji(button, next))}
        />
        <input
          type="text"
          aria-label="Texto do botão"
          placeholder={emoji === null ? 'Botão' : undefined}
          maxLength={LIMITS.buttonLabel}
          value={label}
          style={{ width: `${Math.max(label.length, 3) + 1}ch` }}
          className="min-w-0 border-0 bg-transparent p-0 text-sm font-medium text-white placeholder:text-white/70 focus:outline-none"
          onChange={(event) => onChange({ ...button, label: event.target.value })}
        />
        {isLink ? <span aria-hidden="true" className="text-xs">↗</span> : null}
        <button type="button" aria-label="Remover botão" className={pillIconClass} onClick={onRemove}>
          <CloseIcon />
        </button>
      </div>

      {open ? (
        <div
          id={`${id}-popover`}
          role="dialog"
          aria-label="Configurar botão"
          className="absolute left-0 top-full z-10 mt-2 flex w-[220px] flex-col gap-3 rounded-[8px] border border-white/10 bg-[#111214] p-3 text-left text-[#dbdee1] shadow-2xl"
        >
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`${id}-estilo`} className={fieldLabel}>ESTILO</label>
            <select
              id={`${id}-estilo`}
              value={styleValue}
              className={`${fieldInput} outline-[#4e5058]`}
              onChange={(event) => {
                const option = STYLE_OPTIONS.find((item) => item.style === event.target.value);
                if (option !== undefined) onChange(withStyle(button, option.style));
              }}
            >
              {STYLE_OPTIONS.map((option) => (
                <option key={option.style} value={option.style}>{option.label}</option>
              ))}
            </select>
          </div>

          {isLink ? (
            <div className="flex flex-col gap-0.5">
              <label htmlFor={`${id}-url`} className={fieldLabel}>URL</label>
              <input
                id={`${id}-url`}
                type="url"
                placeholder="https://"
                value={url}
                aria-invalid={urlInvalid ? true : undefined}
                aria-describedby={urlInvalid ? `${id}-url-erro` : undefined}
                className={`${fieldInput} ${urlInvalid ? 'outline-red-400' : 'outline-[#4e5058]'}`}
                onChange={(event) => onChange({ ...button, url: event.target.value })}
              />
              {urlInvalid ? <p id={`${id}-url-erro`} className="text-xs text-red-400">Use um link começando com https://.</p> : null}
            </div>
          ) : (
            <ActionSelect
              id={`${id}-acao`}
              component={componentOf(button)}
              components={components}
              guildId={guildId}
              onChange={(component) => onChange(withComponent(button, component))}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Seletor da ação (Component de botão) do botão; a lista vem do servidor do painel. */
function ActionSelect({ id, component, components, guildId, onChange }: {
  id: string;
  component: number | undefined;
  components: ComponentLoad;
  guildId: string | null;
  onChange: (component: number | undefined) => void;
}) {
  const status = guildId === null ? 'no-guild' : components.status === 'ready' ? 'ready' : components.status === 'error' ? 'error' : 'loading';
  const items = components.status === 'ready' ? components.items : [];
  const missing = component !== undefined && !items.some((item) => item.id === component);
  const hint = status === 'no-guild'
    ? 'Servidor não identificado.'
    : status === 'loading'
      ? 'Carregando Components…'
      : status === 'error'
        ? 'Não foi possível carregar os Components.'
        : items.length === 0
          ? 'Nenhum Component de botão criado ainda. Crie em Components.'
          : null;

  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className={fieldLabel}>AÇÃO</label>
      <select
        id={id}
        disabled={status !== 'ready'}
        aria-describedby={hint === null ? undefined : `${id}-dica`}
        className={`${fieldInput} outline-[#4e5058]`}
        value={component === undefined ? '' : String(component)}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
      >
        <option value="">Sem ação</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
        {component !== undefined && missing ? (
          <option value={component}>{status === 'ready' ? `Component removido (id ${component})` : `Component (id ${component})`}</option>
        ) : null}
      </select>
      {hint === null ? null : (
        <p id={`${id}-dica`} role={status === 'error' ? 'alert' : undefined} className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-[#949ba4]'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
