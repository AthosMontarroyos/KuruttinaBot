'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { card, outlineButton, primaryButton, Skeleton } from '../../ui';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  type TemplateDetail,
  type TemplateErrorCode,
  type TemplateSummary,
  type ValidationDetail,
} from './templates-api';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

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
  version: number | null;
  error: string | null;
  submitting: boolean;
};

function emptyForm(): FormState {
  return { name: '', contentJson: '', version: null, error: null, submitting: false };
}

function MessagesView({ guildId }: { guildId: string }) {
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [form, setForm] = useState<FormState>(emptyForm());
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

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
  }, [loadFirstPage]);

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
      ? await updateTemplate(guildId, view.name, form.version ?? 0, form.contentJson)
      : await createTemplate(guildId, form.name, form.contentJson);
    if (result.ok) {
      await loadFirstPage();
      closeForm();
    } else {
      setForm((current) => ({ ...current, submitting: false, error: errorMessage(result.error, result.details) }));
    }
  }, [closeForm, form.contentJson, form.name, form.version, guildId, loadFirstPage, view]);

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

  if (loading) {
    return (
      <>
        <h1 className="text-[28px] font-semibold">Mensagens</h1>
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
        <h1 className="text-[28px] font-semibold">Mensagens</h1>
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          <p className="max-w-[420px] text-sm leading-6 text-muted">Não foi possível falar com o servidor agora.</p>
          <button className={primaryButton} type="button" onClick={() => void loadFirstPage()}>Tentar de novo</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[28px] font-semibold">Mensagens</h1>
        <button ref={createButtonRef} className={primaryButton} type="button" onClick={openCreate}>Criar modelo</button>
      </div>

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
                <button className={outlineButton} type="button" onClick={() => setDeleteTarget(detail.name)}>Apagar</button>
              </div>
            </>
          )}
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
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item) => (
            <li key={item.name} className={`${card} flex flex-wrap items-center justify-between gap-3 px-5 py-3`}>
              <button
                className="min-w-0 flex-1 text-left text-sm font-medium text-text hover:underline"
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
                <button className={outlineButton} type="button" onClick={() => setDeleteTarget(item.name)}>Apagar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <button className={outlineButton} type="button" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? 'Carregando…' : 'Carregar mais'}
        </button>
      ) : null}
    </>
  );
}

export { MessagesView };
