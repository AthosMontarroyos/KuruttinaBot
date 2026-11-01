'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ACTION_VARIABLES, buildActionValues } from '@kuruttina/message-templates/variables';
import { renderText } from '@kuruttina/message-templates/render';
import { usePathname } from '../../lib/navigation';
import type { Session } from '../../lib/session';
import { GuildResourcesProvider } from './guild-resources';

type Preview = { values: Record<string, string>; botName: string | null };

const NO_PREVIEW: Preview = { values: {}, botName: null };
const PreviewContext = createContext<Preview>(NO_PREVIEW);

/** O preview mostra o texto inteiro, então os tetos do envio real não valem aqui. */
const PREVIEW_VARIABLES = ACTION_VARIABLES.map((variable) => ({ ...variable, maxLength: 1000 }));
const BOT_FALLBACK_NAME = 'Kuruttina';
const serverPath = /^\/dashboard\/([^/]+)/u;

/**
 * Valores de exemplo: o bot faz o papel do usuário que dispara a ação (nome, ID, foto e menção)
 * e o servidor é o aberto no painel. O que o servidor não tem, como o banner, fica vazio.
 */
function buildPreview(session: Session | null, guildId: string | undefined): Preview {
  const guild = session?.guilds?.find((item) => item.id === guildId);
  const bot = session?.bot;
  const name = bot?.name ?? BOT_FALLBACK_NAME;
  const values = buildActionValues({
    user: { id: bot?.id ?? '', name, avatarUrl: bot?.avatarUrl ?? null },
    guild: guild ? { id: guild.id, name: guild.name, iconUrl: guild.iconUrl, bannerUrl: guild.bannerUrl ?? null, memberCount: guild.members } : null,
  });
  // No Discord a menção aparece como `@nome` e o timestamp como data legível.
  values['user.mention'] = `@${name}`;
  values.nowtimestamp = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  return { values, botName: bot?.name ?? null };
}

/** Lê `/api/session` uma vez e monta o preview do servidor da página atual; devolve também o ID desse servidor. */
function usePreview(): { preview: Preview; guildId: string | undefined } {
  const guildId = serverPath.exec(usePathname())?.[1];
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/session', { credentials: 'same-origin' })
      .then((response) => (response.ok ? (response.json() as Promise<Session>) : null))
      .then((body) => { if (active) setSession(body); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const preview = useMemo(() => buildPreview(session, guildId), [session, guildId]);
  return { preview, guildId };
}

function PreviewProvider({ children }: { children: ReactNode }) {
  const { preview, guildId } = usePreview();
  return (
    <PreviewContext.Provider value={preview}>
      <GuildResourcesProvider guildId={guildId}>{children}</GuildResourcesProvider>
    </PreviewContext.Provider>
  );
}

/** Troca as variáveis do texto pelos valores de exemplo; sem preview, devolve o texto como está. */
function usePreviewText(): (text: string) => string {
  const { values } = useContext(PreviewContext);
  return (text) => (Object.keys(values).length === 0 || !text.includes('{') ? text : renderText(text, PREVIEW_VARIABLES, values));
}

const IMAGE_VARIABLES = new Set(ACTION_VARIABLES.filter((variable) => variable.image === true).map((variable) => variable.name));
const imageToken = /^\{([a-z]+(?:\.[a-z]+)*)\}$/u;

/**
 * Campo de imagem: se o valor é só `{variável de imagem}`, devolve a imagem de exemplo (`src` vazio quando
 * o servidor não tem, como no banner); qualquer outro valor passa como está.
 */
function usePreviewImage(): (url: string) => { variable: string | null; src: string } {
  const { values } = useContext(PreviewContext);
  return (url) => {
    const key = imageToken.exec(url)?.[1];
    if (key === undefined || !IMAGE_VARIABLES.has(key)) return { variable: null, src: url };
    return { variable: key, src: values[key] ?? '' };
  };
}

function usePreviewBotName(): string {
  return useContext(PreviewContext).botName ?? BOT_FALLBACK_NAME;
}

export { PreviewProvider, usePreviewBotName, usePreviewImage, usePreviewText };
