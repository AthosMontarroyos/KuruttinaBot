'use client';

import { useEffect, useRef, useState } from 'react';
import { errorText } from '../../../../lib/error-messages';
import { card, primaryButton, StatusSkeleton } from '../../ui';
import { createCustomAction, deleteCustomAction, listCustomActions, type CustomAction, type CustomActionErrorCode, type CustomActionKind } from './custom-actions-api';
import { ButtonConfigModal, compactDangerIconButton, compactOutlineButton, compactPrimaryButton, SelectConfigModal } from './config-modal';

const MAX_ITEMS = 50;

type PanelError = { code: CustomActionErrorCode; text: string };

function actionError(code: CustomActionErrorCode, fallback: string): string {
  return errorText(code, {
    invalid_name: 'Use de 1 a 50 caracteres.',
    quota: 'Você atingiu o limite de 50.',
    duplicate: 'Já existe uma ação com esse nome.',
    not_found: 'Esta ação não existe mais.',
    too_large: fallback,
    invalid_json: fallback,
    unknown: fallback,
  });
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ActionPanel({ guildId, kind, title, description }: { guildId: string; kind: CustomActionKind; title: string; description: string }) {
  const [items, setItems] = useState<CustomAction[] | null>(null);
  const [loadError, setLoadError] = useState<CustomActionErrorCode | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<PanelError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomAction | null>(null);
  const [deleteError, setDeleteError] = useState<PanelError | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [configTarget, setConfigTarget] = useState<CustomAction | null>(null);

  const titleId = `custom-actions-${kind}-title`;
  const inputId = `custom-action-name-${kind}`;
  const cancelRef = useRef<HTMLButtonElement>(null);

  async function load() {
    setLoadError(null);
    const result = await listCustomActions(guildId, kind);
    if (!result.ok) { setLoadError(result.error); return; }
    setItems(result.data.items);
  }

  useEffect(() => { void load(); }, [guildId, kind]);

  useEffect(() => {
    if (deleteTarget) cancelRef.current?.focus();
  }, [deleteTarget]);

  const trimmed = name.trim();
  const atLimit = items !== null && items.length >= MAX_ITEMS;
  const canCreate = items !== null && trimmed.length > 0 && !atLimit && !creating;
  const sessionLost = formError?.code === 'unauthenticated' || deleteError?.code === 'unauthenticated';

  async function create() {
    if (!canCreate) return;
    setCreating(true);
    setFormError(null);
    setNotice(null);
    const result = await createCustomAction(guildId, kind, trimmed);
    setCreating(false);
    if (!result.ok) {
      setFormError({ code: result.error, text: actionError(result.error, 'Não foi possível criar a ação.') });
      return;
    }
    setName('');
    setNotice('Ação criada.');
    await load();
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteCustomAction(guildId, kind, deleteTarget.id);
    setDeleting(false);
    if (!result.ok) { setDeleteError({ code: result.error, text: actionError(result.error, 'Não foi possível apagar a ação.') }); return; }
    setDeleteTarget(null);
    const unlinked = result.data?.unlinked ?? 0;
    setNotice(unlinked > 0 ? `Ação apagada. ${unlinked === 1 ? '1 modelo foi desvinculado.' : `${unlinked} modelos foram desvinculados.`}` : 'Ação apagada.');
    await load();
  }

  function cancelRemove() {
    if (deleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  }

  function renderBody() {
    if (loadError) {
      const expired = loadError === 'unauthenticated';
      return (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="max-w-[420px] text-sm leading-6 text-muted">{actionError(loadError, 'Não foi possível carregar as ações.')}</p>
          {expired ? (
            <button className={primaryButton} type="button" onClick={() => location.assign('/login')}>Entrar de novo</button>
          ) : (
            <button className={primaryButton} type="button" onClick={() => void load()}>Tentar de novo</button>
          )}
        </div>
      );
    }

    if (items === null) {
      return <StatusSkeleton label={`Carregando ${title.toLowerCase()}`} rows={['h-9 w-full', 'h-11']} />;
    }

    return (
      <>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label className="text-sm font-medium" htmlFor={inputId}>Nome da ação</label>
            <input
              id={inputId}
              className="min-h-9 rounded-[10px] border border-control bg-transparent px-3 text-sm"
              type="text"
              maxLength={50}
              value={name}
              disabled={creating}
              onChange={(event) => { setName(event.target.value); setFormError(null); }}
            />
          </div>
          <button className={primaryButton} type="submit" disabled={!canCreate}>Criar</button>
        </form>

        {formError ? <p role="alert" className="text-sm text-red-600">{formError.text}</p> : null}
        {notice ? <p role="status" className="text-sm text-muted">{notice}</p> : null}
        {sessionLost ? (
          <button className={primaryButton} type="button" onClick={() => location.assign('/login')}>Entrar de novo</button>
        ) : null}

        {items.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ação criada ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-control" aria-label={title}>
            {items.map((item) => {
              const confirming = deleteTarget?.id === item.id;
              return (
                <li key={item.id} className="flex min-h-11 items-center justify-between gap-3 px-3">
                  {confirming ? (
                    <div
                      role="group"
                      aria-label={`Confirmar remoção de ${item.name}`}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3"
                      onKeyDown={(event) => { if (event.key === 'Escape') cancelRemove(); }}
                    >
                      <span className="min-w-0 truncate text-sm">{`Apagar “${item.name}”?`}</span>
                      <div className="flex shrink-0 gap-2">
                        <button className={compactPrimaryButton} type="button" disabled={deleting} onClick={() => void confirmRemove()}>Apagar</button>
                        <button ref={cancelRef} className={compactOutlineButton} type="button" disabled={deleting} onClick={cancelRemove}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="min-w-0 cursor-pointer truncate bg-transparent p-0 text-left text-sm font-medium text-text hover:underline"
                        aria-label={`Configurar ${item.name}`}
                        onClick={() => setConfigTarget(item)}
                      >
                        {item.name}
                      </button>
                      <button
                        className={compactDangerIconButton}
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        title="Remover"
                        onClick={() => { setDeleteError(null); setDeleteTarget(item); }}
                      >
                        <XIcon />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {deleteError?.text ? <p role="alert" className="text-sm text-red-600">{deleteError.text}</p> : null}
      </>
    );
  }

  const configProps = {
    guildId,
    onClose: () => setConfigTarget(null),
    onSaved: () => { setFormError(null); setNotice('Configuração salva.'); },
  };

  return (
    <section className={`${card} flex min-w-0 flex-col gap-4 p-4`} aria-labelledby={titleId}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={titleId} className="text-[15px] font-semibold">{title}</h3>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {items !== null ? <span className="shrink-0 text-sm text-muted">{`${items.length}/${MAX_ITEMS}`}</span> : null}
      </header>
      {renderBody()}
      {configTarget ? (
        kind === 'buttons'
          ? <ButtonConfigModal {...configProps} action={configTarget} />
          : <SelectConfigModal {...configProps} action={configTarget} />
      ) : null}
    </section>
  );
}

export function CustomActionsView({ guildId }: { guildId: string }) {
  return (
    <section className="flex flex-col gap-5" aria-label="Components">
      <div className="grid grid-cols-1 gap-5 min-[701px]:grid-cols-2">
        <ActionPanel
          guildId={guildId}
          kind="buttons"
          title="Botões personalizados"
          description="Defina ações para os botões que você cria nas mensagens e nos modelos."
        />
        <ActionPanel
          guildId={guildId}
          kind="selects"
          title="Menus de seleção personalizados"
          description="Defina ações para os menus de seleção que você cria nas mensagens e nos modelos."
        />
      </div>
    </section>
  );
}
