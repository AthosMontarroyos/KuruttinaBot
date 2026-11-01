import { useEffect, useId, useState } from 'react';
import { CUSTOM_FUNCTION_TYPES } from '@kuruttina/message-templates/custom-functions';
import { ChannelSelect } from '../../../../components/selectors/ChannelSelect';
import { SwitchField } from '../../../../components/Switch';
import { VoiceChannelSelect } from '../../../../components/selectors/VoiceChannelSelect';
import { errorText } from '../../../../lib/error-messages';
import { listTemplates, type TemplateErrorCode } from '../embeds/templates/templates-api';
import type { CustomFunction } from './custom-actions-api';

type FunctionFieldKind = 'template' | 'channel' | 'voice_channel' | 'roles' | 'boolean';
type FunctionField = { key: string; kind: FunctionFieldKind; label: string };
export type FunctionTypeMeta = { label: string; description: string; fields: readonly FunctionField[] };

/** Catálogo de tipos de função, na ordem do seletor. */
export const functionTypeMeta: Record<string, FunctionTypeMeta> = CUSTOM_FUNCTION_TYPES;

const MAX_TEMPLATE_PAGES = 20;
const control = 'min-h-11 w-full rounded-[10px] border border-control bg-transparent px-3 text-sm text-text disabled:opacity-60';
const compactOutline = 'inline-flex min-h-8 items-center justify-center rounded-[10px] border border-control bg-transparent px-3 text-sm font-medium text-text hover:bg-surface disabled:opacity-50';

/** Valor inicial de cada campo, usado ao adicionar a função. */
function emptyValue(kind: FunctionFieldKind): unknown {
  if (kind === 'roles') return [];
  if (kind === 'boolean') return false;
  return '';
}

export function defaultFunctionConfig(type: string): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of functionTypeMeta[type]?.fields ?? []) config[field.key] = emptyValue(field.kind);
  return config;
}

/** Lista de IDs de cargo sem entradas vazias ou inválidas. */
export function readRoleIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : [];
}

/** Chave do campo de cargos quando ele é o único campo do tipo (adicionar, remover, alternar, definir cargos); senão `null`. */
export function rolesOnlyFieldKey(type: string): string | null {
  const fields = functionTypeMeta[type]?.fields ?? [];
  const [field] = fields;
  return fields.length === 1 && field?.kind === 'roles' ? field.key : null;
}

type TemplateList = { status: 'loading' } | { status: 'ready'; names: string[] } | { status: 'failed'; error: TemplateErrorCode };

/** Lê todas as páginas de templates (25 por página) até o cursor acabar. */
async function loadAllTemplateNames(guildId: string): Promise<TemplateList> {
  const names: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_TEMPLATE_PAGES; page += 1) {
    const result = await listTemplates(guildId, cursor);
    if (!result.ok) return { status: 'failed', error: result.error };
    names.push(...result.data.items.map((template) => template.name));
    const next = result.data.nextCursor;
    if (next === null || next === cursor) break;
    cursor = next;
  }
  return { status: 'ready', names };
}

function TemplateField({ guildId, label, value, disabled, onChange }: { guildId: string; label: string; value: string; disabled: boolean; onChange: (name: string) => void }) {
  const id = useId();
  const [attempt, setAttempt] = useState(0);
  const [list, setList] = useState<TemplateList>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setList({ status: 'loading' });
    void loadAllTemplateNames(guildId).then((result) => {
      if (active) setList(result);
    });
    return () => {
      active = false;
    };
  }, [guildId, attempt]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      {list.status === 'loading' ? (
        <div role="status" aria-label="Carregando templates" className="min-h-11 animate-pulse rounded-[10px] bg-border motion-reduce:animate-none" />
      ) : null}
      {list.status === 'failed' ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-danger">{errorText(list.error)}</p>
          <button type="button" className={compactOutline} onClick={() => setAttempt((value) => value + 1)}>Tentar de novo</button>
        </div>
      ) : null}
      {list.status === 'ready' && list.names.length === 0 ? (
        <p className="text-sm text-muted">Nenhum template criado ainda. Crie um em Templates.</p>
      ) : null}
      {list.status === 'ready' && list.names.length > 0 ? (
        <select id={id} className={control} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option className="bg-surface text-text" value="">Escolha um template</option>
          {value !== '' && !list.names.includes(value) ? (
            <option className="bg-surface text-text" value={value}>{`${value} (não existe mais)`}</option>
          ) : null}
          {list.names.map((name) => (
            <option key={name} className="bg-surface text-text" value={name}>{name}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function FunctionFieldControl({ guildId, field, value, disabled, onChange }: { guildId: string; field: FunctionField; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const text = typeof value === 'string' ? value : '';
  switch (field.kind) {
    case 'template':
      return <TemplateField guildId={guildId} label={field.label} value={text} disabled={disabled} onChange={onChange} />;
    case 'channel':
      return <ChannelSelect guildId={guildId} label={field.label} value={text} disabled={disabled} onChange={onChange} />;
    case 'voice_channel':
      return <VoiceChannelSelect guildId={guildId} label={field.label} value={text} disabled={disabled} onChange={onChange} />;
    case 'roles':
      return null; // Cargos são editados no painel flutuante da engrenagem (`RoleMultiPicker`), não neste formulário.
    case 'boolean':
      return <SwitchField label={field.label} checked={value === true} disabled={disabled} onChange={onChange} />;
  }
}

/** Formulário gerado a partir dos campos do tipo da função. Cada alteração devolve a função inteira. */
export function FunctionConfigEditor({ guildId, fn, onChange, disabled = false }: { guildId: string; fn: CustomFunction; onChange: (next: CustomFunction) => void; disabled?: boolean }) {
  const meta = functionTypeMeta[fn.type];
  if (!meta) return <p className="text-sm text-muted">Esta função não tem configuração.</p>;
  if (meta.fields.length === 0) return <p className="text-sm text-muted">Esta função não tem nada para configurar.</p>;
  return (
    <div className="flex flex-col gap-4">
      {meta.fields.map((field) => (
        <FunctionFieldControl
          key={field.key}
          guildId={guildId}
          field={field}
          value={fn.config[field.key]}
          disabled={disabled}
          onChange={(value) => onChange({ ...fn, config: { ...fn.config, [field.key]: value } })}
        />
      ))}
    </div>
  );
}
