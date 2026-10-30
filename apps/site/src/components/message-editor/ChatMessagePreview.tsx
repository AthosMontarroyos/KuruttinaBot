'use client';

import { useState, type ReactNode } from 'react';
import { readBotAvatarUrl } from '../../lib/bot-avatar';
import { EmbedCard, InlineText } from './EmbedCard';
import { ComponentsPreview } from './ComponentsPreview';
import { DISCORD_FONT, LIMITS, parseState } from './message-model';

function BotAvatar({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (url !== '' && !failed) {
    return <img className="size-10 shrink-0 rounded-full bg-[#1e1f22] object-cover" src={url} alt="" width={40} height={40} onError={() => setFailed(true)} />;
  }
  return <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#5865f2] font-semibold text-white">K</span>;
}

/** Moldura de mensagem do bot, como aparece no chat do Discord. */
export function ChatMessage({ children }: { children: ReactNode }) {
  const [avatarUrl] = useState(readBotAvatarUrl);
  const [time] = useState(() => new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date()));
  return (
    <div className="flex gap-4 rounded-[14px] bg-[#313338] p-4 text-[15px] leading-[1.4] text-[#dbdee1]" style={{ fontFamily: DISCORD_FONT }}>
      <BotAvatar url={avatarUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">Kuruttina</span>
          <span className="rounded bg-[#5865f2] px-1.5 text-[10px] font-semibold uppercase leading-4 text-white">App</span>
          <span className="text-xs text-[#949ba4]">Hoje às {time}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Como a mensagem aparece no Discord, sem edição. */
export function MessagePreview({ content }: { content: unknown }) {
  const [state] = useState(() => parseState(JSON.stringify(content)));
  if (!state) return null;
  return (
    <ChatMessage>
      <InlineText rich readOnly label="Texto da mensagem" placeholder="" maxLength={LIMITS.content} value={state.content} onChange={() => undefined} />
      {state.embeds.map((embed, index) => <EmbedCard key={embed.key} readOnly embed={embed} index={index} />)}
      <ComponentsPreview rows={state.components} />
    </ChatMessage>
  );
}
