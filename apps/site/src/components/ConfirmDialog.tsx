import { card, outlineButton, primaryButton } from '../app/dashboard/ui';

type ConfirmDialogProps = {
  titleId: string;
  title: string;
  description: string;
  error?: string | null;
  busy?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmDialog({
  titleId,
  title,
  description,
  error = null,
  busy = false,
  confirmLabel = 'Apagar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div role="alertdialog" aria-labelledby={titleId} className={`${card} flex flex-col gap-3 p-5`}>
      <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted">{description}</p>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <button className={primaryButton} type="button" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        <button className={outlineButton} type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export { ConfirmDialog };
