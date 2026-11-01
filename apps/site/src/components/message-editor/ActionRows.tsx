'use client';

import { useState } from 'react';
import { ButtonRowEditor } from './ButtonEditor';
import { SelectRowEditor } from './SelectEditor';
import { newSelectCustomId, record, rowItems, text } from './message-model';

type ActionRowsProps = {
  rows: unknown[];
  onChange: (rows: unknown[]) => void;
};

/** Botão com o popover aberto: a linha dele e a posição nela. */
type EditingButton = { row: number; button: number };

const headerButton = 'flex size-7 shrink-0 items-center justify-center rounded text-[#b5bac1] hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#b5bac1]';
const choiceButton = 'rounded bg-[#383a40] px-3 py-1 text-sm font-medium text-[#dbdee1] hover:bg-[#4e5058] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2]';

/** Nome do tipo da linha no cabeçalho; `null` para pendente ou formato desconhecido. */
function typeLabel(kind: string): string | null {
  if (kind === 'buttons') return 'Botões';
  if (kind === 'select') return 'Menu de seleção';
  return null;
}

/** Linhas de componentes da mensagem: cada uma tem cabeçalho (posição, mover, tipo e remover) e a pré-visualização. Linha de botões mostra os botões no próprio cabeçalho. */
export function ActionRows({ rows, onChange }: ActionRowsProps) {
  const [editing, setEditing] = useState<EditingButton | null>(null);
  if (rows.length === 0) return null;

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...rows];
    const above = next[index - 1];
    next[index - 1] = next[index];
    next[index] = above;
    setEditing(null);
    onChange(next);
  };
  const replace = (index: number, row: unknown) => onChange(rows.map((item, itemIndex) => (itemIndex === index ? row : item)));
  const remove = (index: number) => {
    setEditing(null);
    onChange(rows.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, index) => {
        const number = index + 1;
        const kind = text(record(row).kind);
        const pending = kind === 'pending';
        const label = typeLabel(kind);
        return (
          <div key={index} className="rounded-[8px] bg-[#2b2d31]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[8px] bg-[#1e1f22] px-2.5 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#b5bac1]">Linha {number}</span>
              <button type="button" aria-label={`Mover linha ${number} para cima`} disabled={index === 0} className={headerButton} onClick={() => moveUp(index)}>▲</button>
              {kind === 'buttons' ? (
                <ButtonRowEditor
                  buttons={rowItems(row) ?? []}
                  editing={editing !== null && editing.row === index ? editing.button : null}
                  onEditing={(button) => setEditing(button === null ? null : { row: index, button })}
                  onChange={(buttons) => replace(index, { ...record(row), buttons })}
                />
              ) : pending ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={choiceButton} onClick={() => replace(index, { kind: 'buttons', buttons: [] })}>+ Botão</button>
                  <button type="button" className={choiceButton} onClick={() => replace(index, { kind: 'select', menu: { customId: newSelectCustomId(), options: [] } })}>+ Menu de seleção</button>
                </div>
              ) : kind === 'select' ? (
                <SelectRowEditor row={row} onChange={(next) => replace(index, next)} />
              ) : (
                <span className="text-xs text-[#949ba4]">{label ?? 'Formato desconhecido'}</span>
              )}
              <button type="button" aria-label={`Remover linha ${number}`} className={`${headerButton} ml-auto`} onClick={() => remove(index)}>×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
