'use client';

import { useEffect, useRef, useState } from 'react';
import type { Session } from '../lib/session';

type AccountMenuProps = {
  session: Session | null;
  onLogout: () => void;
};

const trigger = 'inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-control bg-surface p-0 text-muted hover:border-text min-[701px]:size-9';
const item = 'flex min-h-11 w-full items-center rounded-lg bg-transparent px-3 text-left text-sm font-medium text-text hover:bg-border';

function AccountMenu({ session, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent): void => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!session?.authenticated || !session.user) {
    return (
      <a className={`icon-link ${trigger}`} href="/login" aria-label="Entrar">
        <img src="/icons/account/user.svg" alt="" />
      </a>
    );
  }

  const { label, avatarUrl } = session.user;
  return (
    <div ref={root} className="relative">
      <button className={trigger} type="button" aria-label={`Conta de ${label}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)}>
        {avatarUrl && !avatarFailed ? (
          <img className="size-full object-cover" src={avatarUrl} alt="" width={64} height={64} onError={() => setAvatarFailed(true)} />
        ) : (
          <span aria-hidden="true" className="text-sm font-semibold text-text">{[...label][0]?.toUpperCase() ?? '?'}</span>
        )}
      </button>
      {open ? (
        <div role="menu" className="absolute top-full right-0 z-20 mt-2 flex w-56 flex-col rounded-xl border border-border bg-surface p-2">
          <p className="truncate px-3 py-2 text-[13px] text-muted">{label}</p>
          <a role="menuitem" className={item} href="/dashboard">Painel de controle</a>
          <button
            role="menuitem"
            className={item}
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { AccountMenu };
