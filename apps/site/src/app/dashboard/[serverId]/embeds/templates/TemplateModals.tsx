'use client';

import { ChannelSelect } from '../../../../../components/selectors/ChannelSelect';
import { card, outlineButton, primaryButton } from '../../../ui';

type FolderForm = { name: string; error: string | null; submitting: boolean };

function NewFolderForm({
  form,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: FolderForm;
  onChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={`${card} flex flex-col gap-2 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="new-folder-name">Nome da nova pasta</label>
        <input
          id="new-folder-name"
          autoFocus
          className="min-h-9 flex-1 rounded-[10px] border border-control bg-transparent px-3 text-sm"
          type="text"
          value={form.name}
          onChange={(event) => onChange(event.target.value)}
        />
        <button className={primaryButton} type="button" disabled={form.submitting} onClick={onSubmit}>Criar pasta</button>
        <button className={outlineButton} type="button" onClick={onCancel}>Cancelar</button>
      </div>
      {form.error ? <p role="alert" className="text-sm text-red-600">{form.error}</p> : null}
    </div>
  );
}

function RenameFolderForm({
  folderId,
  form,
  onChange,
  onSubmit,
  onCancel,
}: {
  folderId: number;
  form: FolderForm;
  onChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`rename-folder-${folderId}`}>Nome da pasta</label>
      <input
        id={`rename-folder-${folderId}`}
        autoFocus
        className="min-h-9 flex-1 rounded-[10px] border border-control bg-transparent px-3 text-sm"
        type="text"
        value={form.name}
        onChange={(event) => onChange(event.target.value)}
      />
      <button className={primaryButton} type="button" disabled={form.submitting} onClick={onSubmit}>Salvar</button>
      <button className={outlineButton} type="button" onClick={onCancel}>Cancelar</button>
      {form.error ? <p role="alert" className="w-full text-sm text-red-600">{form.error}</p> : null}
    </div>
  );
}

function DeleteFolderDialog({
  name,
  error,
  deleting,
  onConfirm,
  onCancel,
}: {
  name: string;
  error: string | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alertdialog" aria-labelledby="delete-folder-title" className={`${card} flex flex-col gap-3 p-5`}>
      <h2 id="delete-folder-title" className="text-lg font-semibold">Apagar a pasta “{name}”?</h2>
      <p className="text-sm text-muted">Os modelos dessa pasta passam para “Sem pasta”. Essa ação não pode ser desfeita.</p>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <button className={primaryButton} type="button" disabled={deleting} onClick={onConfirm}>Apagar</button>
        <button className={outlineButton} type="button" disabled={deleting} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function DeliveryDialog({
  templateName,
  guildId,
  channelId,
  submitting,
  error,
  success,
  onChannelChange,
  onConfirm,
  onClose,
}: {
  templateName: string;
  guildId: string;
  channelId: string;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onChannelChange: (channelId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div role="dialog" aria-labelledby="delivery-template-title" className={`${card} flex flex-col gap-3 p-5`}>
      <h2 id="delivery-template-title" className="text-lg font-semibold">Enviar “{templateName}” a um canal</h2>
      <ChannelSelect guildId={guildId} value={channelId} onChange={onChannelChange} disabled={submitting} />
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-muted">{success}</p> : null}
      <div className="flex gap-3">
        <button className={primaryButton} type="button" disabled={submitting} onClick={onConfirm}>Enviar</button>
        <button className={outlineButton} type="button" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

function DeleteTemplateDialog({
  name,
  error,
  deleting,
  onConfirm,
  onCancel,
}: {
  name: string;
  error: string | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alertdialog" aria-labelledby="delete-template-title" className={`${card} flex flex-col gap-3 p-5`}>
      <h2 id="delete-template-title" className="text-lg font-semibold">Apagar “{name}”?</h2>
      <p className="text-sm text-muted">Essa ação não pode ser desfeita.</p>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <button className={primaryButton} type="button" disabled={deleting} onClick={onConfirm}>Apagar</button>
        <button className={outlineButton} type="button" disabled={deleting} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export { DeleteFolderDialog, DeleteTemplateDialog, DeliveryDialog, NewFolderForm, RenameFolderForm };
