'use client';

import { useState } from 'react';
import { ConfirmDialog } from '../../../../../components/ConfirmDialog';
import { ChannelSelect } from '../../../../../components/selectors/ChannelSelect';
import { errorText } from '../../../../../lib/error-messages';
import { card, outlineButton, primaryButton } from '../../../ui';
import { requestDelivery, type TemplateErrorCode } from './templates-api';

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
    <ConfirmDialog
      titleId="delete-folder-title"
      title={`Apagar a pasta “${name}”?`}
      description="Os modelos dessa pasta passam para “Sem pasta”. Essa ação não pode ser desfeita."
      error={error}
      busy={deleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function deliveryErrorMessage(error: TemplateErrorCode): string {
  return errorText(error, {
    invalid_channel_id: 'Escolha um canal.',
    not_found: 'Esse modelo de mensagem não existe mais.',
    quota: 'Este servidor tem muitos envios pendentes. Aguarde ou tente mais tarde.',
  });
}

/** Aba "Enviar" do editor: manda a versão salva do modelo a um canal. */
function SendPanel({ guildId, templateName, unsaved }: { guildId: string; templateName: string | null; unsaved: boolean }) {
  const [channelId, setChannelId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (templateName === null) return <p className="text-sm text-muted">Salve o modelo para poder enviá-lo a um canal.</p>;

  const send = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const result = await requestDelivery(guildId, templateName, channelId.trim());
    setSubmitting(false);
    if (result.ok) setSuccess('Pedido de envio registrado. Pode levar alguns instantes.');
    else setError(deliveryErrorMessage(result.error));
  };

  return (
    <div className="flex flex-col gap-3">
      {unsaved ? <p className="text-sm text-muted">Há alterações não salvas: o envio usa a versão salva do modelo.</p> : null}
      <ChannelSelect guildId={guildId} value={channelId} onChange={setChannelId} disabled={submitting} />
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-muted">{success}</p> : null}
      <div>
        <button className={primaryButton} type="button" disabled={submitting} onClick={() => void send()}>Enviar</button>
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
    <ConfirmDialog
      titleId="delete-template-title"
      title={`Apagar “${name}”?`}
      description="Essa ação não pode ser desfeita."
      error={error}
      busy={deleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export { DeleteFolderDialog, DeleteTemplateDialog, NewFolderForm, RenameFolderForm, SendPanel };
