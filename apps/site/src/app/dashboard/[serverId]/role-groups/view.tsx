'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { RoleMark } from '../../../../components/selectors/RoleMark';
import { RoleSelect } from '../../../../components/selectors/RoleSelect';
import { errorText } from '../../../../lib/error-messages';
import { listRoles, type Role } from '../../../../lib/guild-api';
import { card, dangerIconButton, outlineButton, primaryButton, Message, SaveButton, StatusSkeleton, TrashIcon } from '../../ui';
import { createRoleGroup, deleteRoleGroup, listRoleGroups, updateRoleGroup, type RoleGroup, type RoleGroupErrorCode } from './role-groups-api';

const MAX_ROLES = 25;

type Draft = {
  /** Grupo sendo editado; `null` quando é um grupo novo. */
  group: RoleGroup | null;
  name: string;
  roleIds: string[];
  error: string | null;
  submitting: boolean;
};

function roleGroupError(code: RoleGroupErrorCode, fallback: string): string {
  return errorText(code, {
    invalid_group_name: 'Dê um nome de 1 a 50 caracteres.',
    invalid_roles: 'Algum cargo não existe mais neste servidor ou não pode ser dado à mão.',
    duplicate_role: 'Um cargo aparece duas vezes no grupo.',
    duplicate: 'Já existe um grupo com esse nome.',
    conflict: 'Este grupo foi alterado em outro lugar. Recarregue antes de salvar.',
    quota: 'Este servidor já tem o máximo de 25 grupos.',
    bot_not_in_guild: 'O bot não está neste servidor.',
    not_found: 'Este grupo não existe mais.',
    too_large: fallback,
    invalid_json: fallback,
    unknown: fallback,
  });
}

type PreviewProps = { roleIds: string[]; rolesById: Map<string, Role>; onRemove?: ((roleId: string) => void) | undefined };

/** Prévia do card fechado: uma faixa horizontal de chips com ícone e nome na cor do cargo, rolável quando há muitos. */
function ChipList({ roleIds, rolesById }: Omit<PreviewProps, 'onRemove'>) {
  if (roleIds.length === 0) return <p className="text-sm text-muted">Nenhum cargo neste grupo.</p>;
  return (
    <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Cargos do grupo">
      {roleIds.map((roleId) => {
        const role = rolesById.get(roleId);
        return (
          <li
            key={roleId}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-control px-3 py-1 text-sm font-medium"
            style={{ color: role?.color ?? undefined }}
          >
            <RoleMark role={role} />
            <span className="whitespace-nowrap">{role ? `@ ${role.name}` : 'Cargo removido'}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Lista de cargos: uma linha por cargo, com ícone e nome na cor do cargo. Com `onRemove`, cada linha ganha o botão Remover. */
function ListPreview({ roleIds, rolesById, onRemove }: PreviewProps) {
  if (roleIds.length === 0) return <p className="text-sm text-muted">Nenhum cargo neste grupo.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-control" aria-label="Cargos do grupo">
      {roleIds.map((roleId) => {
        const role = rolesById.get(roleId);
        const name = role ? `@ ${role.name}` : 'Cargo removido';
        return (
          <li key={roleId} className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm font-medium" style={{ color: role?.color ?? undefined }}>
            <span className="flex min-w-0 items-center gap-2">
              <RoleMark role={role} />
              <span className="truncate">{name}</span>
            </span>
            {onRemove ? (
              <button type="button" className={outlineButton} aria-label={`Remover ${name}`} onClick={() => onRemove(roleId)}>
                Remover
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RoleGroupsView({ guildId }: { guildId: string }) {
  const [groups, setGroups] = useState<RoleGroup[] | null>(null);
  const [rolesById, setRolesById] = useState<Map<string, Role>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleGroup | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoadError(null);
    const [groupsResult, rolesResult] = await Promise.all([listRoleGroups(guildId), listRoles(guildId)]);
    if (!groupsResult.ok) { setLoadError(roleGroupError(groupsResult.error, 'Não foi possível carregar os grupos.')); return; }
    setGroups(groupsResult.data.items);
    if (rolesResult.ok) setRolesById(new Map(rolesResult.items.map((role) => [role.id, role])));
  }

  useEffect(() => { void load(); }, [guildId]);

  function startDraft(group?: RoleGroup) {
    setNotice(null);
    setDraft({ group: group ?? null, name: group?.name ?? '', roleIds: group?.roleIds ?? [], error: null, submitting: false });
  }

  function addRole(roleId: string) {
    if (!draft || roleId === '' || draft.roleIds.includes(roleId)) return;
    if (draft.roleIds.length >= MAX_ROLES) { setDraft({ ...draft, error: 'Um grupo aceita no máximo 25 cargos.' }); return; }
    setDraft({ ...draft, roleIds: [...draft.roleIds, roleId], error: null });
  }

  function removeRole(roleId: string) {
    if (draft) setDraft({ ...draft, roleIds: draft.roleIds.filter((id) => id !== roleId), error: null });
  }

  async function save() {
    if (!draft) return;
    setDraft({ ...draft, submitting: true, error: null });
    const input = { name: draft.name, roleIds: draft.roleIds };
    const result = draft.group
      ? await updateRoleGroup(guildId, { id: draft.group.id, expectedVersion: draft.group.version }, input)
      : await createRoleGroup(guildId, input);
    if (!result.ok) {
      setDraft({ ...draft, submitting: false, error: roleGroupError(result.error, 'Não foi possível salvar o grupo.') });
      return;
    }
    setDraft(null);
    setNotice(draft.group ? 'Grupo salvo.' : 'Grupo criado.');
    await load();
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteRoleGroup(guildId, deleteTarget.id);
    setDeleting(false);
    if (!result.ok) { setDeleteError(roleGroupError(result.error, 'Não foi possível apagar o grupo.')); return; }
    if (draft?.group?.id === deleteTarget.id) setDraft(null);
    setDeleteTarget(null);
    setNotice('Grupo apagado.');
    await load();
  }

  if (loadError) {
    return <Message title="Cargos indisponíveis" action={<button className={primaryButton} type="button" onClick={() => void load()}>Tentar de novo</button>}>{loadError}</Message>;
  }

  if (groups === null) {
    return <StatusSkeleton label="Carregando grupos de cargos" rows={['h-9 w-60', 'h-[72px]']} />;
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Grupos de cargos">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Grupos de cargos</h2>
          <p className="text-sm text-muted">Agrupe cargos do servidor para oferecê-los juntos.</p>
        </div>
        {draft ? null : <button className={primaryButton} type="button" onClick={() => startDraft()}>Novo grupo</button>}
      </header>

      {notice ? <p role="status" className="text-sm text-muted">{notice}</p> : null}

      {deleteTarget ? (
        <ConfirmDialog
          titleId="delete-role-group-title"
          title={`Apagar o grupo “${deleteTarget.name}”?`}
          description="Essa ação não pode ser desfeita."
          error={deleteError}
          busy={deleting}
          onConfirm={() => void confirmRemove()}
          onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        />
      ) : null}

      {draft ? (
        <div className={`${card} flex flex-col gap-4 p-4`}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="role-group-name">Nome do grupo</label>
            <input
              id="role-group-name"
              className="min-h-9 rounded-[10px] border border-control bg-transparent px-3 text-sm"
              type="text"
              maxLength={50}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value, error: null })}
            />
          </div>

          <RoleSelect guildId={guildId} value="" onChange={addRole} label="Adicionar cargo" disabled={draft.submitting} />

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Prévia</h3>
            <ListPreview roleIds={draft.roleIds} rolesById={rolesById} onRemove={draft.submitting ? undefined : removeRole} />
          </div>

          {draft.error ? <p role="alert" className="text-sm text-red-600">{draft.error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <SaveButton saving={draft.submitting} onClick={() => void save()}>Salvar grupo</SaveButton>
            <button className={outlineButton} type="button" disabled={draft.submitting} onClick={() => setDraft(null)}>Cancelar</button>
          </div>
        </div>
      ) : null}

      {groups.length === 0 && !draft ? (
        <p className="text-sm text-muted">Nenhum grupo ainda. Crie o primeiro para agrupar cargos.</p>
      ) : null}

      {draft ? null : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.id} className={`${card} flex flex-col gap-3 p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[15px] font-semibold">{group.name}</span>
                <div className="flex gap-2">
                  <button className={outlineButton} type="button" onClick={() => startDraft(group)}>Editar</button>
                  <button
                    className={dangerIconButton}
                    type="button"
                    aria-label={`Apagar grupo ${group.name}`}
                    title="Apagar"
                    onClick={() => { setDeleteError(null); setDeleteTarget(group); }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              <ChipList roleIds={group.roleIds} rolesById={rolesById} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { RoleGroupsView };
