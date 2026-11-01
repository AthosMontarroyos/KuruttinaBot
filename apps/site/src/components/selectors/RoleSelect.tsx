'use client';

import type { CSSProperties } from 'react';
import { listRoles, type GuildListResult, type Role } from '../../lib/guild-api';
import { ResourceSelect } from './ResourceSelect';

type RoleSelectProps = {
  /** Servidor cujos cargos são listados. */
  guildId: string;
  /** ID do cargo escolhido; vazio quando nenhum. */
  value: string;
  onChange: (roleId: string) => void;
  /** Rótulo do campo; padrão "Cargo". */
  label?: string;
  /** Inclui os cargos gerenciados (de bots e integrações), que ninguém pode dar à mão; padrão `false`. */
  includeManaged?: boolean;
  disabled?: boolean;
};

// Funções fora do componente: o seletor recarrega a lista quando a função de leitura muda.
async function listAssignableRoles(guildId: string): Promise<GuildListResult<Role>> {
  const result = await listRoles(guildId);
  return result.ok ? { ok: true, items: result.items.filter((role) => !role.managed) } : result;
}

// Cargo sem cor no Discord (padrão) mantém a cor do texto do campo.
function renderRoles(roles: Role[]) {
  return roles.map((role) => (
    <option key={role.id} className="bg-surface text-text" style={role.color ? { color: role.color } : undefined} value={role.id}>{`@ ${role.name}`}</option>
  ));
}

function roleValueStyle(roles: Role[], roleId: string): CSSProperties | undefined {
  const color = roles.find((role) => role.id === roleId)?.color;
  return color ? { color } : undefined;
}

/**
 * Seleção de cargo de um servidor, do mais alto ao mais baixo como no Discord (o `@everyone` não aparece).
 *
 *     <RoleSelect guildId={guildId} value={roleId} onChange={setRoleId} />
 */
function RoleSelect({ guildId, value, onChange, label = 'Cargo', includeManaged = false, disabled = false }: RoleSelectProps) {
  return (
    <ResourceSelect
      guildId={guildId}
      value={value}
      onChange={onChange}
      label={label}
      disabled={disabled}
      load={includeManaged ? listRoles : listAssignableRoles}
      renderOptions={renderRoles}
      valueStyle={roleValueStyle}
      placeholder="Escolha um cargo"
      emptyMessage={includeManaged ? 'Este servidor não tem cargos.' : 'Este servidor não tem cargos que possam ser dados.'}
      manualPlaceholder="ID do cargo"
      loadingLabel="Carregando cargos"
    />
  );
}

export { RoleSelect, listAssignableRoles };
export type { RoleSelectProps };
