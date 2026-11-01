import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { isFunctionConfigComplete, MAX_FUNCTIONS, MAX_OPTIONS, MAX_OPTION_LABEL, MAX_ROLES_PER_FUNCTION } from '@kuruttina/message-templates/custom-functions';
import { RoleMultiPicker } from '../../../../components/selectors/RoleMultiPicker';
import { Switch } from '../../../../components/Switch';
import { errorText } from '../../../../lib/error-messages';
import { card, dangerHover, outlineButton, primaryButton, SaveButton, StatusSkeleton } from '../../ui';
import {
  getButtonConfig,
  getSelectConfig,
  saveButtonConfig,
  saveSelectConfig,
  type CustomActionErrorCode,
  type CustomFunction,
} from './custom-actions-api';
import { defaultFunctionConfig, FunctionConfigEditor, functionTypeMeta, readRoleIds, rolesOnlyFieldKey } from './function-config';

export const compactPrimaryButton = 'inline-flex min-h-8 items-center justify-center rounded-[10px] border-0 bg-button px-3 text-sm font-semibold text-button-text hover:bg-secondary';
export const compactOutlineButton = 'inline-flex min-h-8 items-center justify-center rounded-[10px] border border-control bg-transparent px-3 text-sm font-medium text-text hover:bg-surface';
export const compactDangerIconButton = `inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-control bg-transparent text-text ${dangerHover}`;

const functionTypes = functionTypeMeta;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], select, textarea';
const CONFLICT_TEXT = 'Esta ação foi alterada em outro lugar. Feche e abra de novo para ver a versão atual.';
const INVALID_TEXT = 'A configuração é inválida. Revise e tente de novo.';
const DUPLICATE_OPTION_TEXT = 'Dê um nome único a cada opção.';
const INCOMPLETE_TEXT = 'Configure todas as funções antes de salvar.';
const LOAD_FALLBACK = 'Não foi possível carregar a configuração.';
const SAVE_FALLBACK = 'Não foi possível salvar a configuração.';

type LoadPhase = 'loading' | 'error' | 'ready';

type ModalProps = {
  guildId: string;
  action: { id: number; name: string };
  onClose: () => void;
  onSaved: () => void;
};

// `key` é só o id do React (estável durante a edição); `optionKey` é a chave estável que vai para o servidor.
type OptionDraft = { key: number; optionKey: string; label: string; functions: CustomFunction[] };

const OPTION_KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Chave nova de uma opção: 8 caracteres `[a-z0-9]` via `crypto.getRandomValues`, sem viés (bytes >= 252 são descartados). */
function newOptionKey(): string {
  let key = '';
  const bytes = new Uint8Array(16);
  while (key.length < 8) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 252 && key.length < 8) key += OPTION_KEY_ALPHABET[byte % 36];
    }
  }
  return key;
}

function configErrorText(code: CustomActionErrorCode, fallback: string): string {
  return errorText(code, {
    not_found: 'Esta ação não existe mais.',
    conflict: CONFLICT_TEXT,
    invalid_functions: INVALID_TEXT,
    invalid_options: INVALID_TEXT,
    invalid_reference: 'Um template, canal ou cargo escolhido não existe mais. Revise as funções.',
    bot_not_in_guild: 'O bot não está neste servidor.',
    invalid_name: fallback,
    quota: fallback,
    duplicate: fallback,
    too_large: fallback,
    invalid_json: fallback,
    unknown: fallback,
  });
}

function functionLabel(type: string): string {
  return functionTypes[type]?.label ?? type;
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

/**
 * Lista de tipos de função em fluxo, logo abaixo da linha de chips (ocupa espaço e o corpo do modal rola).
 * Foca o primeiro tipo ao abrir; cada tipo é um botão com a descrição em `title`.
 */
function FunctionTypeList({ id, disabled, onPick }: { id: string; disabled: boolean; onPick: (type: string) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const entries = Object.entries(functionTypes);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, []);

  return (
    <div ref={listRef} id={id} role="group" aria-label="Tipos de função" className="flex flex-col gap-2 rounded-[10px] border border-control p-3">
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Nenhum tipo de função disponível ainda.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {entries.map(([type, meta]) => (
            <button
              key={type}
              type="button"
              title={meta.description}
              disabled={disabled}
              className="rounded-[10px] border border-control px-3 py-2 text-left text-sm hover:bg-surface disabled:opacity-50"
              onClick={() => onPick(type)}
            >
              {meta.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Painel de configuração de uma função, logo abaixo da lista de chips.
 * Foca o primeiro controle ao abrir, fecha com Esc (sem fechar o modal) e devolve o foco à engrenagem.
 */
function FunctionConfigPanel({
  id,
  label,
  guildId,
  fn,
  disabled,
  onChange,
  onClose,
}: {
  id: string;
  label: string;
  guildId: string;
  fn: CustomFunction;
  disabled: boolean;
  onChange: (next: CustomFunction) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const opener = document.activeElement;
    let observer: MutationObserver | null = null;

    function focusFirst(): boolean {
      const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
      if (!first) return false;
      first.focus();
      return true;
    }

    // Os seletores carregam a lista depois de montar: foca o primeiro controle quando ele aparecer,
    // sem roubar o foco se o usuário já tiver saído para outro lugar.
    if (!focusFirst()) {
      observer = new MutationObserver(() => {
        const active = document.activeElement;
        if ((active === document.body || active === opener) && focusFirst()) observer?.disconnect();
      });
      observer.observe(panel, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      if (opener instanceof HTMLElement && opener.isConnected && (document.activeElement === document.body || panel.contains(document.activeElement))) {
        opener.focus();
      }
    };
  }, []);

  // Captura antes do listener de Esc do modal: o Esc aqui fecha só o painel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div ref={panelRef} id={id} role="region" aria-label={`Configuração de ${label}`} className="flex flex-col gap-4 rounded-[10px] border border-control p-3">
      <FunctionConfigEditor guildId={guildId} fn={fn} disabled={disabled} onChange={onChange} />
      <div className="flex justify-end">
        <button type="button" className={compactOutlineButton} onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

/**
 * Lista de chips de função com engrenagem (abre o painel de configuração), indicador de incompleta, X para remover
 * e "+" que abre/fecha a lista de tipos em fluxo. A lista de tipos e o painel nunca ficam abertos ao mesmo tempo.
 */
export function FunctionList({ guildId, functions, onChange, disabled = false }: { guildId: string; functions: CustomFunction[]; onChange: (next: CustomFunction[]) => void; disabled?: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);
  // Funções só de cargos não abrem o painel em fluxo: a engrenagem abre o `RoleMultiPicker` flutuante sobre o chip.
  const [rolesPicker, setRolesPicker] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  const [autoOpenIndex, setAutoOpenIndex] = useState<number | null>(null);
  const closeRolesPicker = useCallback(() => setRolesPicker(null), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const typesId = useId();
  const openFn = openIndex === null ? undefined : functions[openIndex];
  const pickerFn = rolesPicker === null ? undefined : functions[rolesPicker.index];
  const pickerKey = pickerFn === undefined ? null : rolesOnlyFieldKey(pickerFn.type);

  // Função de cargos recém-adicionada: abre o painel sobre o chip assim que ele existe.
  useEffect(() => {
    if (autoOpenIndex === null) return;
    const chip = rootRef.current?.querySelectorAll<HTMLElement>('[data-function-chip]')[autoOpenIndex];
    if (chip) setRolesPicker({ index: autoOpenIndex, anchor: chip });
    setAutoOpenIndex(null);
  }, [autoOpenIndex]);

  // Clique fora fecha a lista de tipos.
  useEffect(() => {
    if (!typesOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (event.target instanceof Node && rootRef.current && !rootRef.current.contains(event.target)) setTypesOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [typesOpen]);

  function removeAt(index: number) {
    setRolesPicker(null);
    setOpenIndex((current) => {
      if (current === null || current === index) return null;
      return current > index ? current - 1 : current;
    });
    onChange(functions.filter((_, i) => i !== index));
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        // Esc fecha só a lista de tipos (sem fechar o modal) e devolve o foco ao "+".
        if (event.key !== 'Escape' || !typesOpen) return;
        event.stopPropagation();
        setTypesOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {functions.map((fn, index) => {
          const label = functionLabel(fn.type);
          const rolesOnly = rolesOnlyFieldKey(fn.type) !== null;
          const expanded = rolesOnly ? rolesPicker?.index === index : openIndex === index;
          const incomplete = !isFunctionConfigComplete(fn);
          return (
            <span key={`${index}-${fn.type}`} data-function-chip="" className="inline-flex min-h-8 items-center gap-1 rounded-full border border-control py-0.5 pl-3 pr-1 text-sm">
              {incomplete ? (
                <span role="img" aria-label="Configuração incompleta" title="Configuração incompleta" className="inline-block size-2 shrink-0 rounded-full bg-amber-500" />
              ) : null}
              <span>{label}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Configurar ${label}`}
                aria-expanded={expanded}
                aria-controls={rolesOnly ? undefined : panelId}
                onClick={(event) => {
                  setTypesOpen(false);
                  if (rolesOnly) {
                    const chip = event.currentTarget.parentElement;
                    setOpenIndex(null);
                    setRolesPicker(expanded || !chip ? null : { index, anchor: chip });
                    return;
                  }
                  setRolesPicker(null);
                  setOpenIndex(expanded ? null : index);
                }}
                className={`inline-flex size-7 items-center justify-center rounded-full hover:bg-surface disabled:opacity-50 ${expanded ? 'bg-surface text-text' : 'text-muted'}`}
              >
                <GearIcon />
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remover ${label}`}
                title="Remover"
                onClick={() => removeAt(index)}
                className={`inline-flex size-7 items-center justify-center rounded-full text-text disabled:opacity-50 ${dangerHover}`}
              >
                <XIcon />
              </button>
            </span>
          );
        })}
        <button
          ref={triggerRef}
          type="button"
          aria-label="Adicionar função"
          aria-expanded={typesOpen}
          aria-controls={typesId}
          disabled={disabled || functions.length >= MAX_FUNCTIONS}
          onClick={() => {
            setOpenIndex(null);
            setRolesPicker(null);
            setTypesOpen((value) => !value);
          }}
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full border border-dashed border-control px-2 text-sm font-semibold text-text hover:bg-surface disabled:opacity-50"
        >
          +
        </button>
      </div>
      {typesOpen ? (
        <FunctionTypeList
          id={typesId}
          disabled={disabled}
          onPick={(type) => {
            setTypesOpen(false);
            onChange([...functions, { type, config: defaultFunctionConfig(type) }]);
            if (rolesOnlyFieldKey(type) !== null) setAutoOpenIndex(functions.length);
            else setOpenIndex(functions.length);
          }}
        />
      ) : null}
      {rolesPicker !== null && pickerFn !== undefined && pickerKey !== null ? (
        <RoleMultiPicker
          guildId={guildId}
          value={readRoleIds(pickerFn.config[pickerKey])}
          anchor={rolesPicker.anchor}
          max={MAX_ROLES_PER_FUNCTION}
          disabled={disabled}
          onChange={(roleIds) => onChange(functions.map((item, i) => (i === rolesPicker.index ? { ...item, config: { ...item.config, [pickerKey]: roleIds } } : item)))}
          onClose={closeRolesPicker}
        />
      ) : null}
      {openIndex !== null && openFn !== undefined ? (
        <FunctionConfigPanel
          key={openIndex}
          id={panelId}
          label={functionLabel(openFn.type)}
          guildId={guildId}
          fn={openFn}
          disabled={disabled}
          onChange={(next) => onChange(functions.map((item, i) => (i === openIndex ? next : item)))}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </div>
  );
}

function LoadError({ code, onRetry }: { code: CustomActionErrorCode; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <p role="alert" className="max-w-[420px] text-sm leading-6 text-muted">{configErrorText(code, LOAD_FALLBACK)}</p>
      {code === 'unauthenticated' ? (
        <button className={primaryButton} type="button" onClick={() => location.assign('/login')}>Entrar de novo</button>
      ) : (
        <button className={primaryButton} type="button" onClick={onRetry}>Tentar de novo</button>
      )}
    </div>
  );
}

function SaveError({ code }: { code: CustomActionErrorCode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p role="alert" className="text-sm text-red-600">{configErrorText(code, SAVE_FALLBACK)}</p>
      {code === 'unauthenticated' ? (
        <button className={primaryButton} type="button" onClick={() => location.assign('/login')}>Entrar de novo</button>
      ) : null}
    </div>
  );
}

/** Casca do dialog: overlay, Esc, clique no fundo, X, confirmação de descarte e rodapé com Salvar/Cancelar. */
function ConfigModalShell({
  titleId,
  title,
  subtitle,
  phase,
  dirty,
  saving,
  canSave,
  blockedMessage,
  onSave,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  subtitle: string;
  phase: LoadPhase;
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  /** Motivo exibido acima do rodapé quando o Salvar está bloqueado por configuração; `null` quando não há. */
  blockedMessage: string | null;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const [discarding, setDiscarding] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Devolve o foco ao botão que abriu o modal.
  useEffect(() => {
    const previous = document.activeElement;
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  // Foco inicial no primeiro controle do corpo, quando ele aparece.
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [phase]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || saving) return;
      if (discarding) {
        setDiscarding(false);
        return;
      }
      if (dirty) {
        setDiscarding(true);
        return;
      }
      onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [discarding, dirty, saving, onClose]);

  function requestClose() {
    if (saving) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${card} flex max-h-[85vh] w-full max-w-[560px] flex-col gap-4 overflow-y-auto p-5`}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold break-words">{title}</h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            title="Fechar"
            disabled={saving}
            onClick={requestClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-control bg-transparent text-text hover:bg-border disabled:opacity-50"
          >
            <XIcon />
          </button>
        </header>

        <div ref={bodyRef} className="flex flex-col gap-4">{children}</div>

        {discarding ? (
          <div role="group" aria-label="Descartar alterações" className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-[10px] border border-control px-3">
            <span className="text-sm">Descartar alterações?</span>
            <div className="flex shrink-0 gap-2">
              <button type="button" className={compactPrimaryButton} onClick={onClose}>Descartar</button>
              <button type="button" className={compactOutlineButton} autoFocus onClick={() => setDiscarding(false)}>Continuar editando</button>
            </div>
          </div>
        ) : null}

        {blockedMessage ? <p aria-live="polite" className="text-sm text-muted">{blockedMessage}</p> : null}

        <footer className="flex flex-wrap justify-end gap-3">
          <SaveButton saving={saving} disabled={!canSave} onClick={onSave}>Salvar</SaveButton>
          <button className={outlineButton} type="button" disabled={saving} onClick={requestClose}>Cancelar</button>
        </footer>
      </div>
    </div>
  );
}

export function ButtonConfigModal({ guildId, action, onClose, onSaved }: ModalProps) {
  const titleId = useId();
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<LoadPhase>('loading');
  const [loadError, setLoadError] = useState<CustomActionErrorCode | null>(null);
  const [version, setVersion] = useState(0);
  const [functions, setFunctions] = useState<CustomFunction[]>([]);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<CustomActionErrorCode | null>(null);

  useEffect(() => {
    let active = true;
    setPhase('loading');
    setLoadError(null);
    void getButtonConfig(guildId, action.id).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setLoadError(result.error);
        setPhase('error');
        return;
      }
      setVersion(result.data.version);
      setFunctions(result.data.functions);
      setSaved(JSON.stringify(result.data.functions));
      setPhase('ready');
    });
    return () => {
      active = false;
    };
  }, [guildId, action.id, attempt]);

  const dirty = phase === 'ready' && JSON.stringify(functions) !== saved;
  const incomplete = functions.some((fn) => !isFunctionConfigComplete(fn));
  const canSave = dirty && !incomplete && !saving;

  function changeFunctions(next: CustomFunction[]) {
    setFunctions(next);
    setSaveError(null);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveButtonConfig(guildId, action.id, { expectedVersion: version, functions });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <ConfigModalShell
      titleId={titleId}
      title={`Botão ${action.name}`}
      subtitle="Defina as funções que serão executadas quando o botão for clicado."
      phase={phase}
      dirty={dirty}
      saving={saving}
      canSave={canSave}
      blockedMessage={phase === 'ready' && incomplete ? INCOMPLETE_TEXT : null}
      onSave={() => void save()}
      onClose={onClose}
    >
      {phase === 'loading' ? <StatusSkeleton label="Carregando configuração" rows={['h-9 w-full', 'h-11']} /> : null}
      {phase === 'error' && loadError ? <LoadError code={loadError} onRetry={() => setAttempt((value) => value + 1)} /> : null}
      {phase === 'ready' ? (
        <>
          <div className="rounded-[10px] border border-control p-3">
            <FunctionList guildId={guildId} functions={functions} disabled={saving} onChange={changeFunctions} />
          </div>
          {saveError ? <SaveError code={saveError} /> : null}
        </>
      ) : null}
    </ConfigModalShell>
  );
}

/** Rótulos já com espaços aparados; uma opção é inválida se estiver vazia ou repetir outro rótulo. */
function optionInvalid(trimmed: string[], index: number): boolean {
  const label = trimmed[index] ?? '';
  return label === '' || trimmed.filter((other) => other === label).length > 1;
}

function snapshot(keepSelection: boolean, options: OptionDraft[]): string {
  return JSON.stringify({ keepSelection, options: options.map(({ label, functions }) => ({ label, functions })) });
}

export function SelectConfigModal({ guildId, action, onClose, onSaved }: ModalProps) {
  const titleId = useId();
  const keepLabelId = useId();
  const nextKey = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<LoadPhase>('loading');
  const [loadError, setLoadError] = useState<CustomActionErrorCode | null>(null);
  const [version, setVersion] = useState(0);
  const [keepSelection, setKeepSelection] = useState(false);
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<CustomActionErrorCode | null>(null);

  useEffect(() => {
    let active = true;
    setPhase('loading');
    setLoadError(null);
    void getSelectConfig(guildId, action.id).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setLoadError(result.error);
        setPhase('error');
        return;
      }
      const drafts: OptionDraft[] = result.data.options.map((option) => ({
        key: nextKey.current++,
        optionKey: option.key,
        label: option.label,
        functions: option.functions,
      }));
      setVersion(result.data.version);
      setKeepSelection(result.data.keepSelection);
      setOptions(drafts);
      setSaved(snapshot(result.data.keepSelection, drafts));
      setPhase('ready');
    });
    return () => {
      active = false;
    };
  }, [guildId, action.id, attempt]);

  const trimmed = options.map((option) => option.label.trim());
  const labelsValid = trimmed.every((_, index) => !optionInvalid(trimmed, index));
  const incomplete = options.some((option) => option.functions.some((fn) => !isFunctionConfigComplete(fn)));
  const dirty = phase === 'ready' && snapshot(keepSelection, options) !== saved;
  const canSave = dirty && labelsValid && !incomplete && !saving;

  function changeOptions(next: OptionDraft[]) {
    setOptions(next);
    setSaveError(null);
  }

  function updateOption(key: number, patch: { label?: string; functions?: CustomFunction[] }) {
    changeOptions(options.map((option) => (option.key === key ? { ...option, ...patch } : option)));
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    changeOptions([...options, { key: nextKey.current++, optionKey: newOptionKey(), label: '', functions: [] }]);
  }

  function removeOption(key: number) {
    changeOptions(options.filter((option) => option.key !== key));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const payload = options.map(({ optionKey, label, functions }) => ({ key: optionKey, label: label.trim(), functions }));
    const result = await saveSelectConfig(guildId, action.id, { expectedVersion: version, keepSelection, options: payload });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <ConfigModalShell
      titleId={titleId}
      title={`Menu de seleção ${action.name}`}
      subtitle="Defina as ações de cada opção que serão executadas quando ela for escolhida."
      phase={phase}
      dirty={dirty}
      saving={saving}
      canSave={canSave}
      blockedMessage={phase === 'ready' && incomplete ? INCOMPLETE_TEXT : null}
      onSave={() => void save()}
      onClose={onClose}
    >
      {phase === 'loading' ? <StatusSkeleton label="Carregando configuração" rows={['h-9 w-full', 'h-11', 'h-24 w-full']} /> : null}
      {phase === 'error' && loadError ? <LoadError code={loadError} onRetry={() => setAttempt((value) => value + 1)} /> : null}
      {phase === 'ready' ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span id={keepLabelId} className="text-sm font-medium">Manter seleção</span>
              <span
                role="img"
                aria-label="Mantém a opção marcada depois de escolher"
                title="Mantém a opção marcada depois de escolher"
                className="inline-flex size-5 items-center justify-center rounded-full border border-control text-xs text-muted"
              >
                ?
              </span>
            </div>
            <Switch
              checked={keepSelection}
              labelledBy={keepLabelId}
              disabled={saving}
              onChange={(next) => {
                setKeepSelection(next);
                setSaveError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">Opções</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">{`${options.length}/${MAX_OPTIONS}`}</span>
                <button
                  type="button"
                  className={compactOutlineButton}
                  disabled={saving || options.length >= MAX_OPTIONS}
                  onClick={addOption}
                >
                  Adicionar opção
                </button>
              </div>
            </div>

            {!labelsValid ? <p aria-live="polite" className="text-sm text-red-600">{DUPLICATE_OPTION_TEXT}</p> : null}

            {options.length === 0 ? <p className="text-sm text-muted">Nenhuma opção criada ainda.</p> : null}

            <ol aria-label="Opções do menu" className="flex flex-col gap-3">
              {options.map((option, index) => {
                const number = index + 1;
                return (
                  <li key={option.key} className="flex flex-col gap-3 rounded-[10px] border border-control p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="min-h-9 min-w-0 flex-1 rounded-[10px] border border-control bg-transparent px-3 text-sm"
                        aria-label={`Rótulo da opção ${number}`}
                        aria-invalid={optionInvalid(trimmed, index)}
                        maxLength={MAX_OPTION_LABEL}
                        value={option.label}
                        disabled={saving}
                        onChange={(event) => updateOption(option.key, { label: event.target.value })}
                      />
                      <button
                        type="button"
                        className={compactDangerIconButton}
                        aria-label={`Remover opção ${number}`}
                        title="Remover"
                        disabled={saving}
                        onClick={() => removeOption(option.key)}
                      >
                        <XIcon />
                      </button>
                    </div>
                    <FunctionList
                      guildId={guildId}
                      functions={option.functions}
                      disabled={saving}
                      onChange={(next) => updateOption(option.key, { functions: next })}
                    />
                  </li>
                );
              })}
            </ol>
          </div>

          {saveError ? <SaveError code={saveError} /> : null}
        </>
      ) : null}
    </ConfigModalShell>
  );
}
