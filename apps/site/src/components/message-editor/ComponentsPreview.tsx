'use client';

import { text, record } from './message-model';
import { usePreviewText } from './preview-values';

const buttonStyles: Record<string, string> = {
  primary: 'bg-[#5865f2] text-white',
  secondary: 'bg-[#4e5058] text-white',
  success: 'bg-[#248046] text-white',
  danger: 'bg-[#da373c] text-white',
  link: 'bg-[#4e5058] text-white',
};

/** Botões e menus do modelo, só para conferir como ficam; a edição deles é pelo modo JSON. */
export function ComponentsPreview({ rows }: { rows: unknown[] }) {
  const fill = usePreviewText();
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, rowIndex) => {
        const data = record(row);
        if (data.kind === 'buttons' && Array.isArray(data.buttons)) {
          return (
            <div key={rowIndex} className="flex flex-wrap gap-2">
              {data.buttons.map((button, buttonIndex) => {
                const item = record(button);
                const style = text(item.style);
                return (
                  <span key={buttonIndex} className={`rounded px-4 py-1.5 text-sm font-medium ${buttonStyles[style] ?? buttonStyles.secondary}`}>
                    {fill(text(item.label))}{style === 'link' ? ' ↗' : ''}
                  </span>
                );
              })}
            </div>
          );
        }
        if (data.kind === 'select') {
          return (
            <div key={rowIndex} className="flex max-w-[400px] items-center justify-between rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#b5bac1]">
              <span>{text(record(data.menu).placeholder) || 'Escolha uma opção'}</span>
              <span aria-hidden="true">⌄</span>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
