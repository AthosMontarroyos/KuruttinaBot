'use client';

import { emojiImageUrl } from '../selectors/EmojiPicker';
import { text, record } from './message-model';
import { usePreviewText } from './preview-values';

export const buttonStyles: Record<string, string> = {
  primary: 'bg-[#5865f2] text-white',
  secondary: 'bg-[#4e5058] text-white',
  success: 'bg-[#248046] text-white',
  danger: 'bg-[#da373c] text-white',
  link: 'bg-[#4e5058] text-white',
};

/** Uma linha de botões ou de menu, como no Discord; linha de formato desconhecido não mostra nada. */
export function ComponentRowPreview({ row }: { row: unknown }) {
  const fill = usePreviewText();
  const data = record(row);
  if (data.kind === 'buttons' && Array.isArray(data.buttons)) {
    return (
      <div className="flex flex-wrap gap-2">
        {data.buttons.map((button, buttonIndex) => {
          const item = record(button);
          const style = text(item.style);
          const emoji = record(item.emoji);
          const emojiName = text(emoji.name);
          const emojiId = text(emoji.id);
          return (
            <span key={buttonIndex} className={`inline-flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium ${buttonStyles[style] ?? buttonStyles.secondary}`}>
              {emojiId !== '' ? <img src={emojiImageUrl(emojiId, emoji.animated === true)} alt={emojiName} className="size-4" /> : emojiName}
              {fill(text(item.label))}{style === 'link' ? ' ↗' : ''}
            </span>
          );
        })}
      </div>
    );
  }
  if (data.kind === 'select') {
    const menu = record(data.menu);
    const options = Array.isArray(menu.options) ? menu.options.map(record) : [];
    // Emoji da opção padrão, ou da primeira, aparece antes do placeholder.
    const shown = options.find((option) => option.default === true) ?? options[0];
    const emoji = record(shown?.emoji);
    const emojiId = text(emoji.id);
    const emojiName = text(emoji.name);
    return (
      <div className="flex max-w-[400px] items-center justify-between rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#b5bac1]">
        <span className="flex min-w-0 items-center gap-1.5">
          {emojiId !== '' ? <img src={emojiImageUrl(emojiId, emoji.animated === true)} alt={emojiName} className="size-4" /> : emojiName}
          {text(menu.placeholder) || 'Escolha uma opção'}
        </span>
        <span aria-hidden="true">⌄</span>
      </div>
    );
  }
  return null;
}

/** Botões e menus do modelo, só para conferir como ficam; a edição deles é pelo modo JSON. */
export function ComponentsPreview({ rows }: { rows: unknown[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, rowIndex) => (
        <ComponentRowPreview key={rowIndex} row={row} />
      ))}
    </div>
  );
}
