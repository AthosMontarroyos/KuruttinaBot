'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type GuildInfo = { id: string; name: string | null; iconUrl: string | null };

const GuildContext = createContext<GuildInfo | null>(null);

/**
 * Disponibiliza o servidor aberto no painel (id, nome e foto) para os componentes que estão dentro dele.
 * `name` e `iconUrl` são opcionais: sem eles, `useGuild()` traz `null` nesses campos.
 */
export function GuildIdProvider({ guildId, name = null, iconUrl = null, children }: {
  guildId: string;
  name?: string | null;
  iconUrl?: string | null;
  children: ReactNode;
}) {
  const value = useMemo<GuildInfo>(() => ({ id: guildId, name, iconUrl }), [guildId, name, iconUrl]);
  return <GuildContext.Provider value={value}>{children}</GuildContext.Provider>;
}

/** Id do servidor do painel; `null` fora de um `GuildIdProvider`. */
export function useGuildId(): string | null {
  return useContext(GuildContext)?.id ?? null;
}

/** Servidor do painel (id, nome, foto); `null` fora de um `GuildIdProvider`. */
export function useGuild(): GuildInfo | null {
  return useContext(GuildContext);
}
