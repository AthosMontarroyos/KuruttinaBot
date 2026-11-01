'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useGuild } from '../../lib/guild-context';
import { EmojiGlyph } from './EmojiGlyph';
import { EmojiPanel, type EmojiValue } from './EmojiPanel';

export type { EmojiValue } from './EmojiPanel';

export type EmojiPickerProps = {
  /** Servidor cujos emojis personalizados aparecem no painel; `null` quando não identificado. */
  guildId: string | null;
  /** Emoji escolhido; `null` quando nenhum. */
  value: EmojiValue | null;
  /** Recebe o emoji escolhido, ou `null` ao remover. */
  onChange: (emoji: EmojiValue | null) => void;
  disabled?: boolean;
  /** Controle opcional do popover, para o pai impedir que dois popovers fiquem abertos ao mesmo tempo. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const triggerClass = 'inline-flex size-5 shrink-0 items-center justify-center rounded text-white/80 hover:bg-white/20 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
const actionButton = 'rounded bg-[#383a40] px-3 py-1 text-sm font-medium text-[#dbdee1] hover:bg-[#4e5058] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#383a40] disabled:hover:text-[#dbdee1]';

export { emojiImageUrl } from './EmojiGlyph';

function SmileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function TriggerContent({ value }: { value: EmojiValue | null }) {
  if (value) return <EmojiGlyph name={value.name} id={value.id} animated={value.animated} imageClass="size-5" textClass="text-sm leading-none" />;
  return <SmileIcon />;
}

/**
 * Escolha de emoji: um botão compacto que mostra o emoji atual e abre um popover com o `EmojiPanel`
 * (emojis padrão e do servidor), mais a opção de remover.
 *
 *     <EmojiPicker guildId={guildId} value={emoji} onChange={setEmoji} />
 */
export function EmojiPicker({ guildId, value, onChange, disabled = false, open, onOpenChange }: EmojiPickerProps) {
  const id = useId();
  const popoverId = `${id}-popover`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = open ?? internalOpen;
  // Nome e foto só valem quando o servidor do contexto é o mesmo do `guildId` recebido.
  const contextGuild = useGuild();
  const guild = contextGuild !== null && contextGuild.id === guildId ? contextGuild : null;

  const setOpen = useCallback((next: boolean) => {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root === null || !(event.target instanceof Node) || root.contains(event.target)) return;
      const focusInside = root.contains(document.activeElement);
      setOpen(false);
      if (focusInside) triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen, setOpen]);

  const apply = (next: EmojiValue | null) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative inline-flex"
      onKeyDown={(event) => {
        if (isOpen && event.key === 'Escape') {
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Escolher emoji"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        disabled={disabled}
        className={triggerClass}
        onClick={() => setOpen(!isOpen)}
      >
        <TriggerContent value={value} />
      </button>

      {isOpen ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Escolher emoji"
          className="absolute left-0 top-full z-10 mt-2 flex w-[352px] flex-col gap-2 text-left"
        >
          <EmojiPanel guildId={guildId} autoFocusSearch guildName={guild?.name ?? null} guildIconUrl={guild?.iconUrl ?? null} onSelect={apply} />
          {value !== null ? (
            <button type="button" className={`${actionButton} w-full`} onClick={() => apply(null)}>Remover emoji</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
