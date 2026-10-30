'use client';

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { listEmojis, type GuildEmoji } from '../../lib/guild-api';
import {
  CATEGORY_DEFS,
  SKIN_TONES,
  SKIN_TONE_LABELS,
  applySkinTone,
  buildCategories,
  matchesTerms,
  queryTerms,
  searchEmojis,
  type CategoryId,
  type EmojiCategory,
  type EmojiEntry,
  type RawEmoji,
  type SkinTone,
} from './emoji-data';

/** Emoji de um botão: unicode (`{ name }`) ou personalizado do servidor (`{ id, name, animated? }`). */
export type EmojiValue = { name: string; id?: string; animated?: boolean };

let emojiDataCache: Promise<EmojiCategory[]> | null = null;

/**
 * Carrega `emojibase-data/pt/compact.json` (import dinâmico, fora do bundle principal) na primeira chamada e
 * reaproveita a mesma promessa depois. Falha não fica em cache: a próxima chamada tenta de novo.
 */
function loadEmojiData(): Promise<EmojiCategory[]> {
  emojiDataCache ??= import('emojibase-data/pt/compact.json').then(
    (module: { default: RawEmoji[] }) => buildCategories(module.default),
    (error: unknown) => {
      emojiDataCache = null;
      throw error;
    },
  );
  return emojiDataCache;
}

export type EmojiPanelProps = {
  /** Servidor cujos emojis personalizados aparecem; `null` quando não identificado (sem aba "Servidor"). */
  guildId: string | null;
  /** Recebe o emoji escolhido. */
  onSelect: (emoji: EmojiValue) => void;
  /** Classes extras para o contêiner (o tamanho padrão é 352 x 380 px). */
  className?: string;
  /** Põe o foco na busca quando o painel monta. */
  autoFocusSearch?: boolean;
  /** Nome do servidor: vira o rótulo da aba "Servidor" e, sem foto, as iniciais. */
  guildName?: string | null;
  /** Foto do servidor (URL do CDN): vira a imagem da aba "Servidor". */
  guildIconUrl?: string | null;
};

/** Iniciais de um nome (até 2 letras), no mesmo formato de `initials` de `apps/site/src/app/dashboard/ui.tsx`. */
function initials(name: string): string {
  return name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => [...part][0] ?? '').join('').toUpperCase();
}

type SectionId = 'servidor' | CategoryId;
type ServerLoad = { status: 'loading' } | { status: 'ready'; items: GuildEmoji[] } | { status: 'error' };
type DataLoad = { status: 'loading' } | { status: 'ready'; categories: EmojiCategory[] } | { status: 'error' };
type Hover = { kind: 'unicode'; emoji: EmojiEntry } | { kind: 'server'; emoji: GuildEmoji };

/** Emojis do servidor já carregados, por guildId. Só sucesso entra; erro é tentado de novo na próxima abertura. */
const serverCache = new Map<string, GuildEmoji[]>();

const TONE_COLORS: Record<SkinTone, string> = {
  0: 'bg-[#fdd835]',
  1: 'bg-[#fde3c4]',
  2: 'bg-[#f2c49b]',
  3: 'bg-[#c98f63]',
  4: 'bg-[#94603f]',
  5: 'bg-[#5b3a26]',
};

const cellClass = 'flex size-8 items-center justify-center rounded hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2]';
const hintClass = 'px-1 pt-2 text-xs text-[#949ba4]';
const errorClass = 'px-1 pt-2 text-xs text-red-400';
const sectionClass = '[content-visibility:auto] [contain-intrinsic-size:auto_600px]';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONS: Record<SectionId, ReactNode> = {
  servidor: (
    <Icon>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </Icon>
  ),
  pessoas: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </Icon>
  ),
  natureza: (
    <Icon>
      <path d="M5 19c0-8 5-13 14-14-.5 9-5 14-14 14z" />
      <path d="M5 19l7-7" />
    </Icon>
  ),
  comida: (
    <Icon>
      <path d="M3 11h18" />
      <path d="M4.5 11a7.5 7.5 0 0 0 15 0" />
      <path d="M9 7.5V5M12 7.5V4M15 7.5V5" />
    </Icon>
  ),
  atividades: (
    <Icon>
      <rect x="2.5" y="7" width="19" height="10" rx="5" />
      <path d="M7 12h4M9 10v4" />
      <path d="M15 11h.01M17 13h.01" />
    </Icon>
  ),
  viagens: (
    <Icon>
      <path d="M5 17v-5l2-5h10l2 5v5" />
      <path d="M3 17h18" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="16" cy="17" r="2" />
    </Icon>
  ),
  objetos: (
    <Icon>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" />
    </Icon>
  ),
  simbolos: (
    <Icon>
      <path d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" />
    </Icon>
  ),
  bandeiras: (
    <Icon>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4L17 12H5" />
    </Icon>
  ),
};

/** Emojis do servidor que casam com a busca, pelo nome. */
function matchServerEmojis(items: GuildEmoji[], query: string): GuildEmoji[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  return items.filter((emoji) => matchesTerms(emoji.name, terms));
}

type UnicodeGridProps = {
  emojis: EmojiEntry[];
  tone: SkinTone;
  onHover: (emoji: EmojiEntry) => void;
  onPick: (emoji: EmojiEntry) => void;
};

/** Grade de emojis padrão. Memoizada para o hover da prévia não redesenhar os botões. */
const UnicodeGrid = memo(function UnicodeGrid({ emojis, tone, onHover, onPick }: UnicodeGridProps) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {emojis.map((emoji, index) => (
        <button
          key={`${index}:${emoji.label}`}
          type="button"
          aria-label={emoji.label}
          title={emoji.label}
          className={cellClass}
          onMouseEnter={() => onHover(emoji)}
          onFocus={() => onHover(emoji)}
          onClick={() => onPick(emoji)}
        >
          <span aria-hidden="true" className="text-[24px] leading-none">{applySkinTone(emoji, tone)}</span>
        </button>
      ))}
    </div>
  );
});

type ServerGridProps = {
  emojis: GuildEmoji[];
  onHover: (emoji: GuildEmoji) => void;
  onPick: (emoji: GuildEmoji) => void;
};

const ServerGrid = memo(function ServerGrid({ emojis, onHover, onPick }: ServerGridProps) {
  return (
    <div role="group" aria-label="Emojis do servidor" className="grid grid-cols-8 gap-0.5">
      {emojis.map((emoji) => (
        <button
          key={emoji.id}
          type="button"
          aria-label={emoji.name}
          title={`:${emoji.name}:`}
          className={cellClass}
          onMouseEnter={() => onHover(emoji)}
          onFocus={() => onHover(emoji)}
          onClick={() => onPick(emoji)}
        >
          <img src={emoji.url} alt="" loading="lazy" className="size-6" />
        </button>
      ))}
    </div>
  );
});

function Preview({ hover, tone }: { hover: Hover | null; tone: SkinTone }) {
  if (hover === null) return <p className="text-xs text-[#949ba4]">Passe o mouse sobre um emoji para ver a prévia.</p>;
  if (hover.kind === 'server') {
    return (
      <>
        <img src={hover.emoji.url} alt="" className="size-8 shrink-0" />
        <span className="truncate text-xs text-[#dbdee1]">{`:${hover.emoji.name}:`}</span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className="shrink-0 text-[32px] leading-none">{applySkinTone(hover.emoji, tone)}</span>
      <span className="truncate text-xs text-[#dbdee1]">{hover.emoji.label}</span>
    </>
  );
}

/**
 * Painel de seleção de emoji, sem gatilho nem popover: abas de categoria à esquerda, busca e grade à direita,
 * prévia e tom de pele embaixo. Os emojis padrão vêm de `loadEmojiData` (carregados ao montar o painel);
 * os do servidor, de `listEmojis`, uma vez por servidor.
 */
export function EmojiPanel({ guildId, onSelect, className, autoFocusSearch = false, guildName = null, guildIconUrl = null }: EmojiPanelProps) {
  const uid = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<SectionId, HTMLElement>());
  const pendingScroll = useRef<SectionId | null>(null);
  const [data, setData] = useState<DataLoad>({ status: 'loading' });
  const [serverState, setServerState] = useState<{ guildId: string | null; load: ServerLoad }>({ guildId, load: { status: 'loading' } });
  const [query, setQuery] = useState('');
  const [tone, setTone] = useState<SkinTone>(0);
  const [hover, setHover] = useState<Hover | null>(null);
  const [activeId, setActiveId] = useState<SectionId>(guildId === null ? 'pessoas' : 'servidor');

  const firstSection: SectionId = guildId === null ? 'pessoas' : 'servidor';
  const sections: SectionId[] = guildId === null ? CATEGORY_DEFS.map((def) => def.id) : ['servidor', ...CATEGORY_DEFS.map((def) => def.id)];
  const shownActive = sections.includes(activeId) ? activeId : firstSection;
  const contentId = `${uid}-conteudo`;

  // Aba do servidor: foto do servidor, senão iniciais do nome, senão o ícone de casinha.
  const serverName = guildName?.trim() ?? '';
  const serverTabLabel = serverName !== '' ? serverName : 'Servidor';
  const serverInitials = serverName === '' ? '' : initials(serverName);
  const serverTabContent: ReactNode = guildIconUrl
    ? <img src={guildIconUrl} alt="" width={24} height={24} className="size-6 rounded-lg object-cover" />
    : serverInitials !== ''
      ? <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-lg bg-[#5865f2] text-[10px] font-semibold leading-none text-white">{serverInitials}</span>
      : ICONS.servidor;

  const cachedServer = guildId === null ? undefined : serverCache.get(guildId);
  const server: ServerLoad = cachedServer !== undefined
    ? { status: 'ready', items: cachedServer }
    : serverState.guildId === guildId ? serverState.load : { status: 'loading' };
  const serverItems = server.status === 'ready' ? server.items : null;
  const categories = data.status === 'ready' ? data.categories : null;

  const terms = queryTerms(query);
  const searching = terms.length > 0;
  const unicodeMatches = useMemo(() => (categories === null ? [] : searchEmojis(categories, query)), [categories, query]);
  const serverMatches = useMemo(() => (serverItems === null ? [] : matchServerEmojis(serverItems, query)), [serverItems, query]);

  useEffect(() => {
    let alive = true;
    loadEmojiData().then(
      (loaded) => {
        if (alive) setData({ status: 'ready', categories: loaded });
      },
      () => {
        if (alive) setData({ status: 'error' });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (guildId === null || serverCache.has(guildId)) return;
    let alive = true;
    setServerState({ guildId, load: { status: 'loading' } });
    listEmojis(guildId).then((result) => {
      if (!alive) return;
      if (result.ok) {
        serverCache.set(guildId, result.items);
        setServerState({ guildId, load: { status: 'ready', items: result.items } });
      } else {
        setServerState({ guildId, load: { status: 'error' } });
      }
    });
    return () => {
      alive = false;
    };
  }, [guildId]);

  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus();
  }, [autoFocusSearch]);

  const registerSection = useCallback((id: SectionId, element: HTMLElement | null) => {
    if (element !== null) sectionRefs.current.set(id, element);
    else sectionRefs.current.delete(id);
  }, []);

  const scrollToSection = (section: SectionId) => {
    sectionRefs.current.get(section)?.scrollIntoView({ block: 'start' });
    setActiveId(section);
  };

  const goTo = (section: SectionId) => {
    if (!searching) {
      scrollToSection(section);
      return;
    }
    // Sai da busca primeiro; a rolagem acontece depois que as seções voltam a aparecer.
    pendingScroll.current = section;
    setActiveId(section);
    setQuery('');
  };

  useEffect(() => {
    const section = pendingScroll.current;
    if (query !== '' || section === null) return;
    pendingScroll.current = null;
    scrollToSection(section);
  }, [query]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (scrollRef.current !== null) scrollRef.current.scrollTop = 0;
    if (value === '') setActiveId(firstSection);
  };

  const onScroll = () => {
    const container = scrollRef.current;
    if (container === null || searching) return;
    const top = container.getBoundingClientRect().top;
    let current: SectionId | null = null;
    for (const section of sections) {
      const element = sectionRefs.current.get(section);
      if (element === undefined) continue;
      if (element.getBoundingClientRect().top - top <= 8) current = section;
      else break;
    }
    if (current !== null) setActiveId(current);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = sections.indexOf(shownActive);
    const last = sections.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = Math.min(index + 1, last);
    else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    const section = next === null ? undefined : sections[next];
    if (section === undefined) return;
    event.preventDefault();
    goTo(section);
    event.currentTarget.querySelector<HTMLElement>(`[data-section="${section}"]`)?.focus();
  };

  const hoverUnicode = useCallback((emoji: EmojiEntry) => setHover({ kind: 'unicode', emoji }), []);
  const hoverServer = useCallback((emoji: GuildEmoji) => setHover({ kind: 'server', emoji }), []);
  const pickUnicode = useCallback((emoji: EmojiEntry) => onSelect({ name: applySkinTone(emoji, tone) }), [onSelect, tone]);
  const pickServer = useCallback(
    (emoji: GuildEmoji) => onSelect({ id: emoji.id, name: emoji.name, ...(emoji.animated ? { animated: true } : {}) }),
    [onSelect],
  );

  const renderTab = (id: SectionId, label: string, content: ReactNode = ICONS[id]) => {
    const selected = shownActive === id;
    return (
      <button
        key={id}
        type="button"
        role="tab"
        id={`${uid}-tab-${id}`}
        data-section={id}
        aria-selected={selected}
        aria-controls={contentId}
        aria-label={label}
        title={label}
        tabIndex={selected ? 0 : -1}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#b5bac1] hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] aria-selected:bg-[#43464d] aria-selected:text-white"
        onClick={() => goTo(id)}
      >
        {content}
      </button>
    );
  };

  const renderSection = (id: SectionId, title: string, body: ReactNode) => (
    <section
      key={id}
      ref={(element) => registerSection(id, element)}
      aria-labelledby={`${uid}-${id}-titulo`}
      className={sectionClass}
    >
      <h3 id={`${uid}-${id}-titulo`} className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
        {title}
      </h3>
      {body}
    </section>
  );

  const serverBody = (): ReactNode => {
    if (server.status === 'loading') return <p role="status" className={hintClass}>Carregando emojis do servidor…</p>;
    if (server.status === 'error') return <p role="alert" className={errorClass}>Não foi possível carregar os emojis do servidor.</p>;
    if (server.items.length === 0) return <p className={hintClass}>Este servidor não tem emojis personalizados.</p>;
    return <ServerGrid emojis={server.items} onHover={hoverServer} onPick={pickServer} />;
  };

  const renderSections = (): ReactNode => {
    const categoryBody: ReactNode = data.status === 'ready'
      ? data.categories.map((category) => renderSection(
        category.id,
        category.label,
        <UnicodeGrid emojis={category.emojis} tone={tone} onHover={hoverUnicode} onPick={pickUnicode} />,
      ))
      : data.status === 'loading'
        ? <p role="status" className={hintClass}>Carregando emojis…</p>
        : <p role="alert" className={errorClass}>Não foi possível carregar os emojis.</p>;
    return (
      <>
        {guildId !== null ? renderSection('servidor', 'Emojis do servidor', serverBody()) : null}
        {categoryBody}
      </>
    );
  };

  const renderResults = (): ReactNode => {
    const serverPending = guildId !== null && server.status === 'loading';
    const total = serverMatches.length + unicodeMatches.length;
    return (
      <div className="flex flex-col gap-1 pt-1">
        {data.status === 'loading' ? <p role="status" className={hintClass}>Carregando emojis…</p> : null}
        {data.status === 'error' ? <p role="alert" className={errorClass}>Não foi possível carregar os emojis.</p> : null}
        {serverPending ? <p role="status" className={hintClass}>Carregando emojis do servidor…</p> : null}
        {total === 0 && data.status === 'ready' && !serverPending ? <p className={hintClass}>Nenhum emoji encontrado.</p> : null}
        {serverMatches.length > 0 ? <ServerGrid emojis={serverMatches} onHover={hoverServer} onPick={pickServer} /> : null}
        {unicodeMatches.length > 0 ? <UnicodeGrid emojis={unicodeMatches} tone={tone} onHover={hoverUnicode} onPick={pickUnicode} /> : null}
      </div>
    );
  };

  return (
    <div className={`flex h-[380px] w-[352px] max-w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-[#2b2d31] text-[#dbdee1] shadow-2xl ${className ?? ''}`}>
      <div className="flex min-h-0 flex-1">
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Categorias de emoji"
          className="flex w-11 shrink-0 flex-col items-center gap-0.5 overflow-y-auto bg-[#1e1f22] py-1"
          onKeyDown={onTabKeyDown}
        >
          {guildId !== null ? renderTab('servidor', serverTabLabel, serverTabContent) : null}
          {CATEGORY_DEFS.map((def) => renderTab(def.id, def.label))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="p-2 pb-1">
            <input
              ref={searchRef}
              type="text"
              aria-label="Buscar emoji"
              placeholder="Buscar emoji"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="h-8 w-full rounded bg-[#1e1f22] px-2 text-sm text-[#dbdee1] placeholder:text-[#949ba4] outline outline-1 outline-[#1e1f22] focus:outline-[#5865f2]"
            />
          </div>
          <div
            id={contentId}
            ref={scrollRef}
            role="tabpanel"
            aria-label="Emojis"
            onScroll={onScroll}
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
          >
            {searching ? renderResults() : renderSections()}
          </div>
        </div>
      </div>

      <div className="flex h-14 shrink-0 items-center gap-3 border-t border-white/5 bg-[#2b2d31] px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Preview hover={hover} tone={tone} />
        </div>
        <div role="group" aria-label="Tom de pele" className="flex shrink-0 items-center gap-1">
          {SKIN_TONES.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={SKIN_TONE_LABELS[option]}
              aria-pressed={tone === option}
              title={SKIN_TONE_LABELS[option]}
              className={`size-4 rounded-full ring-1 ring-white/25 hover:ring-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white aria-pressed:ring-2 aria-pressed:ring-white ${TONE_COLORS[option]}`}
              onClick={() => setTone(option)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
