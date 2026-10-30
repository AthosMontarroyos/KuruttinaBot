'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../../../../../components/ErrorMessage';
import { FloatingNotice } from '../../../../../components/FloatingNotice';
import { describeTemplateIssues } from '../../../../../components/message-editor/format-issue';
import { MessageEditor, MessagePreview } from '../../../../../components/message-editor/MessageEditor';
import { errorText } from '../../../../../lib/error-messages';
import { card, dangerHover, dangerIconButton, outlineButton, PencilIcon, primaryButton, StatusSkeleton, TrashIcon } from '../../../ui';
import { DeleteFolderDialog, DeleteTemplateDialog, NewFolderForm, RenameFolderForm, SendPanel } from './TemplateModals';
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
  updateTemplate,
  type FolderSummary,
  type TemplateDetail,
  type TemplateErrorCode,
  type TemplateSummary,
  type ValidationDetail,
} from './templates-api';

const NO_FOLDER_KEY = '__no_folder__';

function errorMessage(error: TemplateErrorCode, details?: ValidationDetail[]): string {
  if (error === 'validation') {
    return details && details.length > 0
      ? describeTemplateIssues(details).join('\n')
      : 'O conteúdo do modelo não é válido.';
  }
  return errorText(error, {
    invalid_name: 'Esse nome não é válido. Use letras minúsculas, números, _ e -, até 32 caracteres.',
    too_large: 'O conteúdo é grande demais para um modelo de mensagem.',
    duplicate: 'Já existe um modelo de mensagem com esse nome.',
    conflict: 'Esse modelo foi atualizado por outra pessoa. Recarregue e tente de novo.',
    quota: 'Este servidor atingiu o limite de modelos de mensagem.',
    not_found: 'Esse modelo de mensagem não existe mais.',
    invalid_folder: 'Essa pasta não é válida para este servidor.',
  });
}

function folderErrorMessage(error: TemplateErrorCode): string {
  return errorText(error, {
    invalid_folder_name: 'Dê um nome válido para a pasta.',
    duplicate_folder: 'Já existe uma pasta com esse nome.',
    folder_not_found: 'Essa pasta não existe mais.',
    quota: 'Este servidor atingiu o limite de pastas.',
  });
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-6 shrink-0 text-muted" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-5 shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function TemplatesView({ guildId }: { guildId: string }) {
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // `unauthenticated` é sessão expirada (ex.: o servidor foi reiniciado); qualquer outra falha é `unavailable`.
  const [listError, setListError] = useState<false | 'unauthenticated' | 'unavailable'>(false);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [form, setForm] = useState<FormState>(emptyForm());
  const [savedBaseline, setSavedBaseline] = useState<{ name: string; contentJson: string } | null>(null);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [saveNoticeVisible, setSaveNoticeVisible] = useState(false);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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
  const [collapsedFolders, setCollapsedFolders] = useState<ReadonlySet<string>>(new Set());
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

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
      setListError(result.error === 'unauthenticated' ? 'unauthenticated' : 'unavailable');
    }
    setLoading(false);
  }, [guildId]);

  useEffect(() => {
    void loadFirstPage();
    void loadFolders();
  }, [loadFirstPage, loadFolders]);

  useEffect(() => {
    if (view.kind === 'create') nameInputRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (!saveConfirmed) return undefined;
    const leaveAt = window.setTimeout(() => setSaveNoticeVisible(false), 2200);
    const clearAt = window.setTimeout(() => setSaveConfirmed(false), 2520);
    return () => {
      window.clearTimeout(leaveAt);
      window.clearTimeout(clearAt);
    };
  }, [saveConfirmed]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const result = await listTemplates(guildId, nextCursor);
    if (result.ok) {
      setItems((current) => [...current, ...result.data.items]);
      setNextCursor(result.data.nextCursor);
    } else {
      setListError(result.error === 'unauthenticated' ? 'unauthenticated' : 'unavailable');
    }
    setLoadingMore(false);
  }, [guildId, nextCursor]);

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setSavedBaseline({ name: '', contentJson: '' });
    setSaveConfirmed(false);
    setView({ kind: 'create' });
  }, []);

  const openEdit = useCallback(async (name: string) => {
    setView({ kind: 'edit', name });
    setSavedBaseline(null);
    setSaveConfirmed(false);
    setForm({ ...emptyForm(), name, submitting: false });
    const result = await getTemplate(guildId, name);
    if (result.ok) {
      const contentJson = JSON.stringify(result.data.content, null, 2);
      setForm({
        name: result.data.name,
        contentJson,
        folderId: result.data.folderId,
        version: result.data.version,
        error: null,
        submitting: false,
      });
      setSavedBaseline({ name: result.data.name, contentJson });
    } else {
      setForm((current) => ({ ...current, error: errorMessage(result.error, result.details) }));
    }
  }, [guildId]);

  const openDetail = useCallback(async (name: string) => {
    setView({ kind: 'detail', name });
    setShowJson(false);
    setDetail(null);
    setDetailError(null);
    const result = await getTemplate(guildId, name);
    if (result.ok) setDetail(result.data);
    else setDetailError(errorMessage(result.error, result.details));
  }, [guildId]);

  const closeForm = useCallback(() => {
    setView({ kind: 'list' });
    setForm(emptyForm());
    setSavedBaseline(null);
    setSaveConfirmed(false);
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
    const contentJson = form.contentJson;
    setForm((current) => ({ ...current, submitting: true, error: null }));
    const result = view.kind === 'edit'
      ? await updateTemplate(guildId, view.name, form.version ?? 0, contentJson, form.folderId)
      : await createTemplate(guildId, form.name, contentJson, form.folderId);
    if (result.ok) {
      setForm((current) => ({
        ...current,
        name: result.data.name,
        version: result.data.version,
        submitting: false,
        error: null,
      }));
      setSavedBaseline({ name: result.data.name, contentJson });
      setSaveNoticeVisible(true);
      setSaveConfirmed(true);
      if (view.kind === 'create') setView({ kind: 'edit', name: result.data.name });
      const listed = await listTemplates(guildId);
      if (listed.ok) {
        setItems(listed.data.items);
        setNextCursor(listed.data.nextCursor);
      }
    } else {
      setForm((current) => ({ ...current, submitting: false, error: errorMessage(result.error, result.details) }));
    }
  }, [form.contentJson, form.folderId, form.name, form.version, guildId, view]);

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

  const toggleFolder = useCallback((key: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

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
        <StatusSkeleton label="Carregando modelos de mensagem" rows={['h-11 w-48', 'h-16', 'h-16']} />
      </>
    );
  }

  if (listError) {
    return (
      <>
        <h2 className="text-[22px] font-semibold">Templates de mensagem</h2>
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          {listError === 'unauthenticated' ? (
            <>
              <p className="max-w-[420px] text-sm leading-6 text-muted">Sua sessão expirou. Entre de novo para continuar.</p>
              <button className={primaryButton} type="button" onClick={() => location.assign('/login')}>Entrar de novo</button>
            </>
          ) : (
            <>
              <p className="max-w-[420px] text-sm leading-6 text-muted">Não foi possível falar com o servidor agora.</p>
              <button className={primaryButton} type="button" onClick={() => void loadFirstPage()}>Tentar de novo</button>
            </>
          )}
        </div>
      </>
    );
  }

  const groups = groupByFolder(folders, items);
  const editing = view.kind === 'create' || view.kind === 'edit';
  const unsaved = savedBaseline !== null && (form.name !== savedBaseline.name || form.contentJson !== savedBaseline.contentJson);
  const savedNotice = editing && !unsaved && saveConfirmed;
  const editorNotice = !editing ? null : unsaved ? 'As alterações ainda não foram salvas.' : savedNotice ? 'Alterações salvas.' : null;
  const noticeMotion = savedNotice && !saveNoticeVisible ? 'animate-notice-out' : 'animate-notice-in';

  return (
    <>
      {editorNotice ? <FloatingNotice key={editorNotice} motionClass={noticeMotion}>{editorNotice}</FloatingNotice> : null}
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
        <NewFolderForm
          form={folderForm}
          onChange={(name) => setFolderForm((current) => ({ ...current, name }))}
          onSubmit={() => void submitFolderForm()}
          onCancel={closeFolderForm}
        />
      ) : null}

      {moveError ? <p role="alert" className="text-sm text-red-600">{moveError}</p> : null}

      {deleteFolderTarget ? (
        <DeleteFolderDialog
          name={deleteFolderTarget.name}
          error={deleteFolderError}
          deleting={deletingFolder}
          onConfirm={() => void confirmDeleteFolder()}
          onCancel={() => setDeleteFolderTarget(null)}
        />
      ) : null}

      {view.kind === 'create' || view.kind === 'edit' ? (
        <div className={`${card} flex animate-notice-in flex-col gap-4 p-5 motion-reduce:animate-none`}>
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
              maxLength={32}
              aria-describedby="template-name-hint"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value.toLowerCase().replace(/\s+/gu, '-').replace(/[^a-z0-9_-]/gu, '') }))}
            />
            <p id="template-name-hint" className="text-[13px] text-muted">Use letras minúsculas, números, _ e -, até 32 caracteres.</p>
          </div>
          {view.kind === 'edit' && form.version === null ? (
            form.error ? null : <StatusSkeleton label="Carregando modelo" rows={['h-40']} />
          ) : (
            <MessageEditor
              key={view.kind === 'edit' ? view.name : 'create'}
              initialJson={form.contentJson}
              onChange={(contentJson) => setForm((current) => ({ ...current, contentJson }))}
              sendPanel={<SendPanel guildId={guildId} templateName={view.kind === 'edit' ? view.name : null} unsaved={unsaved} />}
            />
          )}
          {form.error ? <ErrorMessage message={form.error} /> : null}
          <div className="flex gap-3">
            <button className={`${primaryButton} ${unsaved && !form.submitting ? 'animate-save-attention motion-reduce:animate-none' : ''}`} type="button" disabled={form.submitting} onClick={() => void submitForm()}>
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
            <ErrorMessage message={detailError} />
          ) : !detail ? (
            <StatusSkeleton label="Carregando modelo" rows={['h-6 w-40', 'h-28']} />
          ) : (
            <>
              {showJson ? (
                <pre className="overflow-auto rounded-[10px] border border-control bg-transparent px-3 py-2 font-mono text-[13px] leading-5">
                  {JSON.stringify(detail.content, null, 2)}
                </pre>
              ) : (
                <MessagePreview content={detail.content} />
              )}
              <div className="flex flex-wrap gap-3">
                <button className={outlineButton} type="button" aria-pressed={showJson} onClick={() => setShowJson((current) => !current)}>
                  {showJson ? 'Ver mensagem' : 'Ver JSON'}
                </button>
                <button className={outlineButton} type="button" onClick={() => void openEdit(detail.name)}>Editar</button>
                <button className={outlineButton} type="button" onClick={() => setDeleteTarget(detail.name)}>Apagar</button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {deleteTarget ? (
        <DeleteTemplateDialog
          name={deleteTarget}
          error={deleteError}
          deleting={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}

      {editing ? null : items.length === 0 ? (
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
              {renameTarget?.id === group.folderId && group.folderId !== null ? (
                <RenameFolderForm
                  folderId={group.folderId}
                  form={renameForm}
                  onChange={(name) => setRenameForm((current) => ({ ...current, name }))}
                  onSubmit={() => void submitRenameFolder()}
                  onCancel={closeRenameFolder}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {group.folderId !== null ? (
                    <button
                      className="flex min-w-0 items-center gap-2 rounded-[10px] px-1 py-1 text-left hover:bg-surface"
                      type="button"
                      aria-expanded={!collapsedFolders.has(group.key)}
                      aria-controls={`folder-items-${group.key}`}
                      aria-label={`${collapsedFolders.has(group.key) ? 'Mostrar' : 'Esconder'} modelos da pasta ${group.name}`}
                      title={collapsedFolders.has(group.key) ? 'Mostrar modelos' : 'Esconder modelos'}
                      onClick={() => toggleFolder(group.key)}
                    >
                      <ChevronIcon open={!collapsedFolders.has(group.key)} />
                      <FolderIcon />
                      <h3 className="truncate text-base font-semibold text-muted">{group.name}</h3>
                      <span className="text-[13px] text-muted">({group.items.length})</span>
                    </button>
                  ) : (
                    <h3 className="text-base font-semibold text-muted">{group.name}</h3>
                  )}
                  {group.folderId !== null ? (
                    <div className="ml-auto flex gap-1">
                      <button className={iconButton} type="button" aria-label={`Renomear pasta ${group.name}`} title="Renomear pasta" onClick={() => openRenameFolder({ id: group.folderId as number, name: group.name, createdAt: '' })}>
                        <PencilIcon />
                      </button>
                      <button className={`${iconButton} ${dangerHover}`} type="button" aria-label={`Apagar pasta ${group.name}`} title="Apagar pasta" onClick={() => setDeleteFolderTarget({ id: group.folderId as number, name: group.name, createdAt: '' })}>
                        <TrashIcon />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {group.folderId !== null && collapsedFolders.has(group.key) ? null : group.items.length === 0 ? (
                <p id={`folder-items-${group.key}`} className="rounded-[10px] border border-dashed border-control px-5 py-3 text-[13px] text-muted">Arraste um modelo para cá.</p>
              ) : (
                <ul id={`folder-items-${group.key}`} className="m-0 flex list-none flex-col gap-3 p-0">
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
                      </button>
                      <div className="flex items-center gap-2">
                        <button className={outlineButton} type="button" onClick={() => void openEdit(item.name)}>Editar</button>
                        <button className={dangerIconButton} type="button" aria-label={`Apagar modelo ${item.name}`} title="Apagar" onClick={() => setDeleteTarget(item.name)}>
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {!editing && nextCursor ? (
        <button className={outlineButton} type="button" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? 'Carregando…' : 'Carregar mais'}
        </button>
      ) : null}
    </>
  );
}

export { TemplatesView };
