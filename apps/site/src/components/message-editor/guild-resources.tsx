'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SuggestionItem, SuggestionKind } from './autocomplete';
import { listChannels, listEmojis, listRoles, listVoiceChannels } from '../../lib/guild-api';

type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ResourceState<T> = { status: ResourceStatus; items: T[] };
export type GuildResources = {
  emoji: ResourceState<Extract<SuggestionItem, { kind: 'emoji' }>>;
  channel: ResourceState<Extract<SuggestionItem, { kind: 'channel' }>>;
  role: ResourceState<Extract<SuggestionItem, { kind: 'role' }>>;
  /** Começa a buscar a lista na primeira chamada; as seguintes não fazem nada. */
  load: (kind: SuggestionKind) => void;
};

type EmojiItem = Extract<SuggestionItem, { kind: 'emoji' }>;
type ChannelItem = Extract<SuggestionItem, { kind: 'channel' }>;
type RoleItem = Extract<SuggestionItem, { kind: 'role' }>;

/** Sem Provider (ou sem servidor), tudo fica ocioso e `load` não faz nada. */
const idleResources: GuildResources = {
  emoji: { status: 'idle', items: [] },
  channel: { status: 'idle', items: [] },
  role: { status: 'idle', items: [] },
  load: () => {},
};

const GuildResourcesContext = createContext<GuildResources>(idleResources);

const idle = <T,>(): ResourceState<T> => ({ status: 'idle', items: [] });

/**
 * Dados do servidor (emojis, canais e cargos) para os painéis de sugestão do editor. Cada lista é buscada uma vez
 * por servidor, na primeira vez que `load` é chamado para ela.
 *
 * Trocar de `guildId` remonta o escopo (a `key` é o próprio id), então tudo volta ao estado ocioso e as listas do
 * servidor anterior não vazam para o novo.
 */
export function GuildResourcesProvider({ guildId, children }: { guildId: string | undefined; children: ReactNode }) {
  return <GuildResourcesScope key={guildId ?? ''} guildId={guildId}>{children}</GuildResourcesScope>;
}

function GuildResourcesScope({ guildId, children }: { guildId: string | undefined; children: ReactNode }) {
  const [emoji, setEmoji] = useState<ResourceState<EmojiItem>>(idle);
  const [channel, setChannel] = useState<ResourceState<ChannelItem>>(idle);
  const [role, setRole] = useState<ResourceState<RoleItem>>(idle);
  const requested = useRef(new Set<SuggestionKind>());
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback((kind: SuggestionKind) => {
    if (guildId === undefined || requested.current.has(kind)) return;
    requested.current.add(kind);

    if (kind === 'emoji') {
      setEmoji({ status: 'loading', items: [] });
      listEmojis(guildId).then((result) => {
        if (!mounted.current) return;
        setEmoji(result.ok
          ? { status: 'ready', items: result.items.map((item): EmojiItem => ({ kind: 'emoji', id: item.id, name: item.name, animated: item.animated, url: item.url })) }
          : { status: 'error', items: [] });
      });
    } else if (kind === 'channel') {
      setChannel({ status: 'loading', items: [] });
      // A lista de canais de voz pode falhar sem derrubar a de texto: nesse caso fica pronta só com os de texto.
      Promise.all([listChannels(guildId), listVoiceChannels(guildId)]).then(([texts, voices]) => {
        if (!mounted.current) return;
        if (!texts.ok) {
          setChannel({ status: 'error', items: [] });
          return;
        }
        const items: ChannelItem[] = [
          ...texts.items.map((item): ChannelItem => ({ kind: 'channel', id: item.id, name: item.name, group: item.category, voice: false })),
          ...(voices.ok ? voices.items.map((item): ChannelItem => ({ kind: 'channel', id: item.id, name: item.name, group: item.category, voice: true })) : []),
        ];
        setChannel({ status: 'ready', items });
      });
    } else {
      setRole({ status: 'loading', items: [] });
      listRoles(guildId).then((result) => {
        if (!mounted.current) return;
        setRole(result.ok
          ? { status: 'ready', items: result.items.map((item): RoleItem => ({ kind: 'role', id: item.id, name: item.name, color: item.color })) }
          : { status: 'error', items: [] });
      });
    }
  }, [guildId]);

  const value = useMemo<GuildResources>(() => ({ emoji, channel, role, load }), [emoji, channel, role, load]);

  return <GuildResourcesContext.Provider value={value}>{children}</GuildResourcesContext.Provider>;
}

export function useGuildResources(): GuildResources {
  return useContext(GuildResourcesContext);
}
