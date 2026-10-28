'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { card, outlineButton, primaryButton, Skeleton } from '../../../ui';
import {
  createFolder,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listFolders,
  listTemplates,
  moveTemplate,
  removeFolder,
  renameFolder,
  requestDelivery,
  updateTemplate,
  type FolderSummary,
  type TemplateDetail,
  type TemplateErrorCode,
  type TemplateSummary,
  type ValidationDetail,
} from './templates-api';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const NO_FOLDER_KEY = '__no_folder__';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

function errorMessage(error: TemplateErrorCode, details?: ValidationDetail[]): string {
  switch (error) {
    case 'invalid_name':
      return 'Esse nome não é válido para um modelo de mensagem.';
    case 'too_large':
      return 'O conteúdo é grande demais para um modelo de mensagem.';
    case 'validation':
      return details && details.length > 0
        ? `O conteúdo tem um problema: ${details.map((item) => item.message).join('; ')}`
        : 'O conteúdo do modelo não é válido.';
    case 'duplicate':
      return 'Já existe um modelo de mensagem com esse nome.';
    case 'conflict':
      return 'Esse modelo foi atualizado por outra pessoa. Recarregue e tente de novo.';
    case 'quota':
      return 'Este servidor atingiu o limite de modelos de mensagem.';
    case 'not_found':
      return 'Esse modelo de mensagem não existe mais.';
    case 'invalid_folder':
      return 'Essa pasta não é válida para este servidor.';
    case 'unauthenticated':
      return 'Sua sessão expirou. Entre de novo para continuar.';
    default:
      return 'Não foi possível falar com o servidor agora.';
  }
}

function folderErrorMessage(error: TemplateErrorCode): string {
  switch (error) {
    case 'invalid_folder_name':
      return 'Dê um nome válido para a pasta.';
    case 'duplicate_folder':
      return 'Já existe uma pasta com esse nome.';
    case 'folder_not_found':
      return 'Essa pasta não existe mais.';
    case 'quota':
      return 'Este servidor atingiu o limite de pastas.';
    case 'unauthenticated':
      return 'Sua sessão expirou. Entre de novo para continuar.';
    default:
      return 'Não foi possível falar com o servidor agora.';
  }
}

function deliveryErrorMessage(error: TemplateErrorCode): string {
  switch (error) {
    case 'invalid_channel_id':
      return 'Informe o ID do canal.';
    case 'not_found':
      return 'Esse modelo de mensagem não existe mais.';
    case 'quota':
      return 'Este servidor tem muitos envios pendentes. Aguarde ou tente mais tarde.';
    case 'unauthenticated':
      return 'Sua sessão expirou. Entre de novo para continuar.';
    default:
      return 'Não foi possível falar com o servidor agora.';
  }
}

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; name: string } | { kind: 'detail'; name: string };

type FormState = {
  name: string;
  contentJson: string;
  folderId: number | null;
  version: number | null;
  error: string | null;
  submitting: boolean;
};

function emptyForm(): FormState {
  return { name: '', contentJson: '', folderId: null, version: null, error: null, submitting: false };
}

type FolderFormState = { name: string; error: string | null; submitting: boolean };

function emptyFolderForm(): FolderFormState {
  return { name: '', error: null, submitting: false };
}

type TemplateGroup = { key: string; folderId: number | null; name: string; items: TemplateSummary[] };

/** Uma linha por pasta cadastrada, mesmo sem nenhum template dentro ainda — ela
 * precisa aparecer na lista para servir de alvo de arrastar e soltar. "Sem
 * pasta" sempre aparece por último, pelo mesmo motivo. */
function groupByFolder(folders: FolderSummary[], items: TemplateSummary[]): TemplateGroup[] {
  const groups = new Map<string, TemplateGroup>(
    folders.map((folder) => [String(folder.id), { key: String(folder.id), folderId: folder.id, name: folder.name, items: [] }]),
  );
  const noFolder: TemplateGroup = { key: NO_FOLDER_KEY, folderId: null, name: 'Sem pasta', items: [] };
  for (const item of items) {
    const key = item.folderId === null ? NO_FOLDER_KEY : String(item.folderId);
    const group = key === NO_FOLDER_KEY ? noFolder : groups.get(key);
    // Pasta apagada entre o carregamento da lista e das pastas: trata como sem pasta, não derruba a tela.
    (group ?? noFolder).items.push(item);
  }
  return [...groups.values(), noFolder];
}

const iconButton = 'inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-control bg-transparent text-text hover:bg-surface';

function NewFolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M12 11v4M10 13h4" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-muted" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

function TemplatesView({ guildId }: { guildId: string }) {
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState(false);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [form, setForm] = useState<FormState>(emptyForm());
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deliveryTarget, setDeliveryTarget] = useState<string | null>(null);
  const [deliveryChannelId, setDeliveryChannelId] = useState('');
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliverySuccess, setDeliverySuccess] = useState<string | null>(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderForm, setFolderForm] = useState<FolderFormState>(emptyFolderForm());
  const [renameTarget, setRenameTarget] = useState<FolderSummary | null>(null);
  const [renameForm, setRenameForm] = useState<FolderFormState>(emptyFolderForm());
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderSummary | null>(null);
  const [deleteFolderError, setDeleteFolderError] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [draggedTemplate, setDraggedTemplate] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  const loadFolders = useCallback(async () => {
    const result = await listFolders(guildId);
    if (result.ok) setFolders(result.data.items);
  }, [guildId]);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setListError(false);
    const result = await listTemplates(guildId);
    if (result.ok) {
      setItems(result.data.items);
      setNextCursor(result.data.nextCursor);
    } else {
      setListError(true);
    }
    setLoading(false);
  }, [guildId]);

  useEffect(() => {
    void loadFirstPage();
    void loadFolders();
  }, [loadFirstPage, loadFolders]);

  useEffect(() => {
    if (view.kind === 'create') nameInputRef.current?.focus();
    else if (view.kind === 'edit') contentInputRef.current?.focus();
  }, [view]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const result = await listTemplates(guildId, nextCursor);
    if (result.ok) {
      setItems((current) => [...current, ...result.data.items]);
      setNextCursor(result.data.nextCursor);
    } else {
      setListError(true);
    }
    setLoadingMore(false);
  }, [guildId, nextCursor]);

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setView({ kind: 'create' });
  }, []);

  const openEdit = useCallback(async (name: string) => {
    setView({ kind: 'edit', name });
    setForm({ ...emptyForm(), name, submitting: false });
    const result = await getTemplate(guildId, name);
    if (result.ok) {
      setForm({
        name: result.data.name,
        contentJson: JSON.stringify(result.data.content, null, 2),
        folderId: result.data.folderId,
        version: result.data.version,
        error: null,
        submitting: false,
      });
    } else {
      setForm((current) => ({ ...current, error: errorMessage(result.error, result.details) }));
    }
  }, [guildId]);

  const openDetail = useCallback(async (name: string) => {
    setView({ kind: 'detail', name });
    setDetail(null);
    setDetailError(null);
    const result = await getTemplate(guildId, name);
    if (result.ok) setDetail(result.data);
    else setDetailError(errorMessage(result.error, result.details));
  }, [guildId]);

  const closeForm = useCallback(() => {
    setView({ kind: 'list' });
    setForm(emptyForm());
    createButtonRef.current?.focus();
  }, []);

  const closeDetail = useCallback(() => {
    setView({ kind: 'list' });
    setDetail(null);
    setDetailError(null);
    createButtonRef.current?.focus();
  }, []);

  const submitForm = useCallback(async () => {
    if (form.name.trim() === '' || form.contentJson.trim() === '') {
      setForm((current) => ({ ...current, error: 'Preencha o nome e o conteúdo do modelo.' }));
      return;
    }
    try {
      JSON.parse(form.contentJson);
    } catch {
      setForm((current) => ({ ...current, error: 'O conteúdo precisa ser um JSON válido.' }));
      return;
    }
    setForm((current) => ({ ...current, submitting: true, error: null }));
    const result = view.kind === 'edit'
      ? await updateTemplate(guildId, view.name, form.version ?? 0, form.contentJson, form.folderId)
      : await createTemplate(guildId, form.name, form.contentJson, form.folderId);
    if (result.ok) {
      await loadFirstPage();
      closeForm();
    } else {
      setForm((current) => ({ ...current, submitting: false, error: errorMessage(result.error, result.details) }));
    }
  }, [closeForm, form.contentJson, form.folderId, form.name, form.version, guildId, loadFirstPage, view]);

  const openDelivery = useCallback((name: string) => {
    setDeliveryTarget(name);
    setDeliveryChannelId('');
    setDeliveryError(null);
    setDeliverySuccess(null);
  }, []);

  const closeDelivery = useCallback(() => {
    setDeliveryTarget(null);
    setDeliveryChannelId('');
    setDeliveryError(null);
    setDeliverySuccess(null);
  }, []);

  const confirmDelivery = useCallback(async () => {
    if (!deliveryTarget) return;
    setDeliverySubmitting(true);
    setDeliveryError(null);
    const result = await requestDelivery(guildId, deliveryTarget, deliveryChannelId.trim());
    setDeliverySubmitting(false);
    if (result.ok) {
      setDeliverySuccess('Pedido de envio registrado. Pode levar alguns instantes.');
    } else {
      setDeliveryError(deliveryErrorMessage(result.error));
    }
  }, [deliveryChannelId, deliveryTarget, guildId]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteTemplate(guildId, deleteTarget);
    setDeleting(false);
    if (result.ok) {
      setDeleteTarget(null);
      if (view.kind === 'detail' && view.name === deleteTarget) setView({ kind: 'list' });
      await loadFirstPage();
    } else {
      setDeleteError(errorMessage(result.error));
    }
  }, [deleteTarget, guildId, loadFirstPage, view]);

  const openFolderForm = useCallback(() => {
    setFolderForm(emptyFolderForm());
    setShowFolderForm(true);
  }, []);

  const closeFolderForm = useCallback(() => {
    setShowFolderForm(false);
    setFolderForm(emptyFolderForm());
  }, []);

  const submitFolderForm = useCallback(async () => {
    if (folderForm.name.trim() === '') {
      setFolderForm((current) => ({ ...current, error: 'Dê um nome válido para a pasta.' }));
      return;
    }
    setFolderForm((current) => ({ ...current, submitting: true, error: null }));
    const result = await createFolder(guildId, folderForm.name.trim());
    if (result.ok) {
      await loadFolders();
      closeFolderForm();
    } else {
      setFolderForm((current) => ({ ...current, submitting: false, error: folderErrorMessage(result.error) }));
    }
  }, [closeFolderForm, folderForm.name, guildId, loadFolders]);

  const openRenameFolder = useCallback((folder: FolderSummary) => {
    setRenameTarget(folder);
    setRenameForm({ name: folder.name, error: null, submitting: false });
  }, []);

  const closeRenameFolder = useCallback(() => {
    setRenameTarget(null);
    setRenameForm(emptyFolderForm());
  }, []);

  const submitRenameFolder = useCallback(async () => {
    if (!renameTarget) return;
    if (renameForm.name.trim() === '') {
      setRenameForm((current) => ({ ...current, error: 'Dê um nome válido para a pasta.' }));
      return;
    }
    setRenameForm((current) => ({ ...current, submitting: true, error: null }));
    const result = await renameFolder(guildId, renameTarget.id, renameForm.name.trim());
    if (result.ok) {
      await loadFolders();
      await loadFirstPage();
      closeRenameFolder();
    } else {
      setRenameForm((current) => ({ ...current, submitting: false, error: folderErrorMessage(result.error) }));
    }
  }, [closeRenameFolder, guildId, loadFirstPage, loadFolders, renameForm.name, renameTarget]);

  const confirmDeleteFolder = useCallback(async () => {
    if (!deleteFolderTarget) return;
    setDeletingFolder(true);
    setDeleteFolderError(null);
    const result = await removeFolder(guildId, deleteFolderTarget.id);
    setDeletingFolder(false);
    if (result.ok) {
      setDeleteFolderTarget(null);
      await loadFolders();
      await loadFirstPage();
    } else {
      setDeleteFolderError(folderErrorMessage(result.error));
    }
  }, [deleteFolderTarget, guildId, loadFirstPage, loadFolders]);

  const handleDropOnGroup = useCallback(async (targetFolderId: number | null) => {
    const name = draggedTemplate;
    setDraggedTemplate(null);
    setDragOverKey(null);
    if (!name) return;
    const current = items.find((item) => item.name === name);
    if (!current || current.folderId === targetFolderId) return;
    setMoveError(null);
    const result = await moveTemplate(guildId, name, targetFolderId);
    if (result.ok) {
      setItems((currentItems) => currentItems.map((item) => (item.name === name ? { ...item, folderId: targetFolderId, folderName: folders.find((folder) => folder.id === targetFolderId)?.name ?? null } : item)));
    } else {
      setMoveError(errorMessage(result.error));
    }
  }, [draggedTemplate, folders, guildId, items]);

  if (loading) {
    return (
      <>
        <h2 className="text-[22px] font-semibold">Templates de mensagem</h2>
        <div role="status" aria-label="Carregando modelos de mensagem" className="flex flex-col gap-3">
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </>
    );
  }

  if (listError) {
    return (
      <>
        <h2 className="text-[22px] font-semibold">Templates de mensagem</h2>
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          <p className="max-w-[420px] text-sm leading-6 text-muted">Não foi possível falar com o servidor agora.</p>
          <button className={primaryButton} type="button" onClick={() => void loadFirstPage()}>Tentar de novo</button>
        </div>
      </>
    );
  }

  const groups = groupByFolder(folders, items);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-[22px] font-semibold">Templates de mensagem</h2>
        <div className="flex items-center gap-2">
          <button className={iconButton} type="button" aria-label="Nova pasta" title="Nova pasta" onClick={openFolderForm}>
            <NewFolderIcon />
          </button>
          <button ref={createButtonRef} className={primaryButton} type="button" onClick={openCreate}>Criar modelo</button>
        </div>
      </div>

      {showFolderForm ? (
        <div className={`${card} flex flex-col gap-2 p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="new-folder-name">Nome da nova pasta</label>
            <input
              id="new-folder-name"
              autoFocus
              className="min-h-9 flex-1 rounded-[10px] border border-control bg-transparent px-3 text-sm"
              type="text"
              value={folderForm.name}
              onChange={(event) => setFolderForm((current) => ({ ...current, name: event.target.value }))}
            />
            <button className={primaryButton} type="button" disabled={folderForm.submitting} onClick={() => void submitFolderForm()}>Criar pasta</button>
            <button className={outlineButton} type="button" onClick={closeFolderForm}>Cancelar</button>
          </div>
          {folderForm.error ? <p role="alert" className="text-sm text-red-600">{folderForm.error}</p> : null}
        </div>
      ) : null}

      {moveError ? <p role="alert" className="text-sm text-red-600">{moveError}</p> : null}

      {deleteFolderTarget ? (
        <div role="alertdialog" aria-labelledby="delete-folder-title" className={`${card} flex flex-col gap-3 p-5`}>
          <h2 id="delete-folder-title" className="text-lg font-semibold">Apagar a pasta “{deleteFolderTarget.name}”?</h2>
          <p className="text-sm text-muted">Os modelos dessa pasta passam para “Sem pasta”. Essa ação não pode ser desfeita.</p>
          {deleteFolderError ? <p role="alert" className="text-sm text-red-600">{deleteFolderError}</p> : null}
          <div className="flex gap-3">
            <button className={primaryButton} type="button" disabled={deletingFolder} onClick={() => void confirmDeleteFolder()}>Apagar</button>
            <button className={outlineButton} type="button" disabled={deletingFolder} onClick={() => setDeleteFolderTarget(null)}>Cancelar</button>
          </div>
        </div>
      ) : null}

      {view.kind === 'create' || view.kind === 'edit' ? (
        <div className={`${card} flex flex-col gap-4 p-5`}>
          <h2 className="text-lg font-semibold">{view.kind === 'edit' ? `Editar “${view.name}”` : 'Criar modelo de mensagem'}</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="template-name">Nome</label>
            <input
              ref={nameInputRef}
              id="template-name"
              className="min-h-11 rounded-[10px] border border-control bg-transparent px-3 text-sm"
              type="text"
              value={form.name}
              disabled={view.kind === 'edit'}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="template-folder">Pasta</label>
            <select
              id="template-folder"
              className="min-h-11 rounded-[10px] border border-control bg-transparent px-3 text-sm"
              value={form.folderId ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, folderId: event.target.value === '' ? null : Number(event.target.value) }))}
            >
              <option value="">Sem pasta</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="template-content">Conteúdo (JSON)</label>
            <textarea
              ref={contentInputRef}
              id="template-content"
              className="min-h-[220px] rounded-[10px] border border-control bg-transparent px-3 py-2 font-mono text-[13px] leading-5"
              value={form.contentJson}
              onChange={(event) => setForm((current) => ({ ...current, contentJson: event.target.value }))}
            />
          </div>
          {form.error ? <p role="alert" className="text-sm text-red-600">{form.error}</p> : null}
          <div className="flex gap-3">
            <button className={primaryButton} type="button" disabled={form.submitting} onClick={() => void submitForm()}>
              {view.kind === 'edit' ? 'Salvar alterações' : 'Criar modelo'}
            </button>
            <button className={outlineButton} type="button" onClick={closeForm}>Cancelar</button>
          </div>
        </div>
      ) : null}

      {view.kind === 'detail' ? (
        <div className={`${card} flex flex-col gap-4 p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{view.name}</h2>
            <button className={outlineButton} type="button" onClick={closeDetail}>Fechar</button>
          </div>
          {detailError ? (
            <p role="alert" className="text-sm text-red-600">{detailError}</p>
          ) : !detail ? (
            <div role="status" aria-label="Carregando modelo" className="flex flex-col gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-28" />
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 text-sm">
                <div><dt className="text-muted">Pasta</dt><dd>{detail.folderName ?? 'Sem pasta'}</dd></div>
                <div><dt className="text-muted">Versão</dt><dd>{detail.version}</dd></div>
                <div><dt className="text-muted">Botões</dt><dd>{detail.buttonCount}</dd></div>
                <div><dt className="text-muted">Menus</dt><dd>{detail.menuCount}</dd></div>
                <div><dt className="text-muted">Atualizado em</dt><dd>{formatDate(detail.updatedAt)}</dd></div>
              </dl>
              <pre className="overflow-auto rounded-[10px] border border-control bg-transparent px-3 py-2 font-mono text-[13px] leading-5">
                {JSON.stringify(detail.content, null, 2)}
              </pre>
              <div className="flex gap-3">
                <button className={outlineButton} type="button" onClick={() => void openEdit(detail.name)}>Editar</button>
                <button className={outlineButton} type="button" onClick={() => openDelivery(detail.name)}>Enviar ao canal</button>
                <button className={outlineButton} type="button" onClick={() => setDeleteTarget(detail.name)}>Apagar</button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {deliveryTarget ? (
        <div role="dialog" aria-labelledby="delivery-template-title" className={`${card} flex flex-col gap-3 p-5`}>
          <h2 id="delivery-template-title" className="text-lg font-semibold">Enviar “{deliveryTarget}” a um canal</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="delivery-channel-id">ID do canal</label>
            <input
              id="delivery-channel-id"
              className="min-h-11 rounded-[10px] border border-control bg-transparent px-3 text-sm"
              type="text"
              value={deliveryChannelId}
              onChange={(event) => setDeliveryChannelId(event.target.value)}
            />
          </div>
          {deliveryError ? <p role="alert" className="text-sm text-red-600">{deliveryError}</p> : null}
          {deliverySuccess ? <p className="text-sm text-muted">{deliverySuccess}</p> : null}
          <div className="flex gap-3">
            <button className={primaryButton} type="button" disabled={deliverySubmitting} onClick={() => void confirmDelivery()}>Enviar</button>
            <button className={outlineButton} type="button" onClick={closeDelivery}>Fechar</button>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div role="alertdialog" aria-labelledby="delete-template-title" className={`${card} flex flex-col gap-3 p-5`}>
          <h2 id="delete-template-title" className="text-lg font-semibold">Apagar “{deleteTarget}”?</h2>
          <p className="text-sm text-muted">Essa ação não pode ser desfeita.</p>
          {deleteError ? <p role="alert" className="text-sm text-red-600">{deleteError}</p> : null}
          <div className="flex gap-3">
            <button className={primaryButton} type="button" disabled={deleting} onClick={() => void confirmDelete()}>Apagar</button>
            <button className={outlineButton} type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          <p className="max-w-[420px] text-sm leading-6 text-muted">Nenhum modelo de mensagem criado ainda neste servidor.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div
              key={group.key}
              className={`flex flex-col gap-3 rounded-[14px] p-2 ${dragOverKey === group.key ? 'bg-border' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragOverKey(group.key); }}
              onDragLeave={() => setDragOverKey((current) => (current === group.key ? null : current))}
              onDrop={(event) => { event.preventDefault(); void handleDropOnGroup(group.folderId); }}
            >
              {renameTarget?.id === group.folderId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`rename-folder-${group.folderId}`}>Nome da pasta</label>
                  <input
                    id={`rename-folder-${group.folderId}`}
                    autoFocus
                    className="min-h-9 flex-1 rounded-[10px] border border-control bg-transparent px-3 text-sm"
                    type="text"
                    value={renameForm.name}
                    onChange={(event) => setRenameForm((current) => ({ ...current, name: event.target.value }))}
                  />
                  <button className={primaryButton} type="button" disabled={renameForm.submitting} onClick={() => void submitRenameFolder()}>Salvar</button>
                  <button className={outlineButton} type="button" onClick={closeRenameFolder}>Cancelar</button>
                  {renameForm.error ? <p role="alert" className="w-full text-sm text-red-600">{renameForm.error}</p> : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {group.folderId !== null ? <FolderIcon /> : null}
                  <h3 className="text-base font-semibold text-muted">{group.name}</h3>
                  {group.folderId !== null ? (
                    <div className="ml-auto flex gap-1">
                      <button className={iconButton} type="button" aria-label={`Renomear pasta ${group.name}`} title="Renomear pasta" onClick={() => openRenameFolder({ id: group.folderId as number, name: group.name, createdAt: '' })}>
                        <PencilIcon />
                      </button>
                      <button className={iconButton} type="button" aria-label={`Apagar pasta ${group.name}`} title="Apagar pasta" onClick={() => setDeleteFolderTarget({ id: group.folderId as number, name: group.name, createdAt: '' })}>
                        <TrashIcon />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {group.items.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-control px-5 py-3 text-[13px] text-muted">Arraste um modelo para cá.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {group.items.map((item) => (
                    <li
                      key={item.name}
                      draggable
                      onDragStart={() => setDraggedTemplate(item.name)}
                      onDragEnd={() => { setDraggedTemplate(null); setDragOverKey(null); }}
                      className={`${card} flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${draggedTemplate === item.name ? 'opacity-50' : ''}`}
                    >
                      <button
                        className="min-w-0 flex-1 cursor-grab text-left text-sm font-medium text-text hover:underline active:cursor-grabbing"
                        type="button"
                        onClick={() => void openDetail(item.name)}
                      >
                        {item.name}
                        <span className="block text-[13px] font-normal text-muted">
                          {item.buttonCount} botões · {item.menuCount} menus · versão {item.version} · atualizado em {formatDate(item.updatedAt)}
                        </span>
                      </button>
                      <div className="flex gap-2">
                        <button className={outlineButton} type="button" onClick={() => void openEdit(item.name)}>Editar</button>
                        <button className={outlineButton} type="button" onClick={() => openDelivery(item.name)}>Enviar ao canal</button>
                        <button className={outlineButton} type="button" onClick={() => setDeleteTarget(item.name)}>Apagar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {nextCursor ? (
        <button className={outlineButton} type="button" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? 'Carregando…' : 'Carregar mais'}
        </button>
      ) : null}
    </>
  );
}

export { TemplatesView };
