import type { Role } from '../../lib/guild-api';

/** Ícone do cargo como o Discord mostra: imagem própria, emoji ou um ponto da cor do cargo. */
function RoleMark({ role }: { role: Role | undefined }) {
  if (role?.iconUrl) return <img src={role.iconUrl} alt="" width={16} height={16} className="size-4 shrink-0 rounded-sm" />;
  if (role?.unicodeEmoji) return <span aria-hidden="true" className="shrink-0 text-sm leading-4">{role.unicodeEmoji}</span>;
  return <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ background: role?.color ?? 'transparent' }} />;
}

export { RoleMark };
