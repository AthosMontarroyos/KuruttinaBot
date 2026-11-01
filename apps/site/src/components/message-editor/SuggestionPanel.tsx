'use client';

import { useEffect } from 'react';
import type { SuggestionItem, SuggestionKind } from './autocomplete';

export type SuggestionPanelProps = {
  /** Id do listbox; as opções usam `${id}-opcao-${índice}`. */
  id: string;
  kind: SuggestionKind;
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Itens já filtrados pelo que foi digitado. */
  items: SuggestionItem[];
  activeIndex: number;
  onPick: (item: SuggestionItem) => void;
  /** Chamado ao passar o mouse por uma opção. */
  onActive: (index: number) => void;
};

const headings: Record<SuggestionKind, string> = { emoji: 'Emojis', channel: 'Canais', role: 'Cargos' };
const roleFallbackColor = '#99aab5';

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

/** Conteúdo de uma opção, conforme o tipo do item. */
function OptionContent({ item }: { item: SuggestionItem }) {
  if (item.kind === 'emoji') {
    return (
      <>
        <img src={item.url} alt="" width={24} height={24} className="size-6 shrink-0 object-contain" />
        <span className="min-w-0 truncate">:{item.name}:</span>
      </>
    );
  }
  if (item.kind === 'channel') {
    return (
      <>
        <span aria-hidden="true" className="flex w-4 shrink-0 justify-center text-[#949ba4]">{item.voice ? <SpeakerIcon /> : '#'}</span>
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        {item.group ? <span className="max-w-[45%] truncate text-xs text-[#949ba4]">{item.group}</span> : null}
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: item.color ?? roleFallbackColor }} />
      <span className="min-w-0 truncate">{item.name}</span>
    </>
  );
}

/** Lista de sugestões (emojis, canais ou cargos) que abre sob o campo de texto. Os cliques não tiram o foco do campo. */
export function SuggestionPanel({ id, kind, status, items, activeIndex, onPick, onActive }: SuggestionPanelProps) {
  // Mantém a opção ativa visível quando a seta do teclado passa dela.
  useEffect(() => {
    document.getElementById(`${id}-opcao-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, activeIndex]);

  const message = items.length > 0
    ? null
    : status === 'error'
      ? 'Não foi possível carregar a lista.'
      : status === 'ready'
        ? 'Nada encontrado.'
        : 'Carregando…';

  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-full max-w-[360px] overflow-hidden rounded-md bg-[#2b2d31] shadow-lg ring-1 ring-black/40">
      <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">{headings[kind]}</p>
      {message === null ? (
        <div id={id} role="listbox" className="max-h-60 overflow-y-auto pb-1">
          {items.map((item, index) => (
            <div
              key={`${item.kind}-${item.id}`}
              id={`${id}-opcao-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(item)}
              onMouseEnter={() => onActive(index)}
              className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm text-[#dbdee1] ${index === activeIndex ? 'bg-[#404249]' : ''}`}
            >
              <OptionContent item={item} />
            </div>
          ))}
        </div>
      ) : (
        <p className="px-2 pb-3 pt-1 text-sm text-[#949ba4]">{message}</p>
      )}
    </div>
  );
}
