/**
 * Utilitário de Namespacing Seguro para custom_id de Componentes V2 (Botões e Menus).
 * Formato Seguro: scope:guildId:commandId:action:extra
 */

export interface ParsedCustomId {
  scope: string;
  guildId: string;
  commandId: string;
  action: string;
  extra?: string;
}

export function createCustomId(
  scope: 'affiliate' | 'public' | 'system' | 'dev',
  guildId: string,
  commandId: string,
  action: string,
  extra = ''
): string {
  const parts = [scope, guildId, commandId, action, extra].filter(Boolean);
  return parts.join(':');
}

export function parseCustomId(customId: string): ParsedCustomId | null {
  if (!customId || typeof customId !== 'string') return null;

  const parts = customId.split(':');
  if (parts.length < 4) return null;

  return {
    scope: parts[0],
    guildId: parts[1],
    commandId: parts[2],
    action: parts[3],
    extra: parts[4] || undefined,
  };
}
