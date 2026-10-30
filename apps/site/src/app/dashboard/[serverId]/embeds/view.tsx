'use client';

import { useState } from 'react';
import { card, outlineButton } from '../../ui';
import { CustomActionsView } from '../custom-actions/view';
import { TemplatesView } from './templates/view';

type EmbedsSection = 'menu' | 'templates' | 'components';

const menuRow = `${card} flex w-full items-center gap-4 px-5 py-4 text-left text-text hover:border-text`;
const iconBox = 'flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-border text-text';

function TemplatesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function ComponentsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 text-muted" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={`${outlineButton} self-start`} type="button" onClick={onClick}>
      ← Voltar a Mensagens
    </button>
  );
}

function EmbedsMenu({ onSelect }: { onSelect: (section: Exclude<EmbedsSection, 'menu'>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <button className={menuRow} type="button" onClick={() => onSelect('templates')}>
        <span className={iconBox}><TemplatesIcon /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">Templates</span>
          <span className="text-[13px] text-muted">Crie mensagens com embeds para usar, enviar ou reaproveitar em outros módulos.</span>
        </span>
        <ChevronRight />
      </button>
      <button className={menuRow} type="button" onClick={() => onSelect('components')}>
        <span className={iconBox}><ComponentsIcon /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">Components</span>
          <span className="text-[13px] text-muted">Crie botões e menus para usar nas mensagens.</span>
        </span>
        <ChevronRight />
      </button>
    </div>
  );
}

function ComponentsView({ guildId, onBack }: { guildId: string; onBack: () => void }) {
  return (
    <>
      <BackButton onClick={onBack} />
      <h2 className="text-[22px] font-semibold">Components</h2>
      <CustomActionsView guildId={guildId} />
    </>
  );
}

function EmbedsView({ guildId }: { guildId: string }) {
  const [section, setSection] = useState<EmbedsSection>('menu');

  return (
    <>
      <h1 className="text-[28px] font-semibold">Mensagens</h1>
      {section === 'menu' ? (
        <EmbedsMenu onSelect={setSection} />
      ) : section === 'templates' ? (
        <>
          <BackButton onClick={() => setSection('menu')} />
          <TemplatesView guildId={guildId} />
        </>
      ) : (
        <ComponentsView guildId={guildId} onBack={() => setSection('menu')} />
      )}
    </>
  );
}

export { EmbedsView };
