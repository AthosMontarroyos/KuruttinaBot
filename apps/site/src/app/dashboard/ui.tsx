import type { ReactNode } from 'react';
import { SpinnerIcon } from '../../components/icons';
import type { Guild } from '../../lib/session';

const card = 'rounded-[14px] border border-border bg-surface';
const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-[10px] border-0 bg-button px-5 text-sm font-semibold text-button-text hover:bg-secondary';
const outlineButton = 'inline-flex min-h-11 items-center justify-center rounded-[10px] border border-control bg-transparent px-4 text-sm font-medium text-text hover:border-accent-fg hover:text-accent-fg';
/** Fica vermelho ao passar o mouse e no foco do teclado; usado nos botões de apagar. */
const dangerHover = 'transition-colors hover:border-danger hover:bg-danger/10 hover:text-danger focus-visible:border-danger focus-visible:text-danger';
/** Mesma altura do `outlineButton` (44px), para alinhar com o Editar. */
const dangerIconButton = `inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-control bg-transparent text-text ${dangerHover}`;
const memberFormat = new Intl.NumberFormat('pt-BR');

function initials(name: string): string {
  return name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => [...part][0] ?? '').join('').toUpperCase();
}

const guildIconBox = {
  sm: 'size-9 rounded-[10px] text-sm',
  lg: 'size-11 rounded-xl text-base',
  xl: 'size-14 rounded-[12px] text-lg',
} as const;

function GuildIcon({ guild, size }: { guild: Guild; size: keyof typeof guildIconBox }) {
  const box = guildIconBox[size];
  return guild.iconUrl ? (
    <img className={`${box} shrink-0 object-cover`} src={guild.iconUrl} alt="" width={64} height={64} />
  ) : (
    <span aria-hidden="true" className={`${box} flex shrink-0 items-center justify-center bg-border font-semibold`}>{initials(guild.name)}</span>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-border motion-reduce:animate-none ${className}`} />;
}

function StatusSkeleton({ label, rows }: { label: string; rows: readonly string[] }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {rows.map((className, index) => <Skeleton key={`${className}-${index}`} className={className} />)}
    </div>
  );
}

function Message({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-[420px] text-sm leading-6 text-muted">{children}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

type SaveButtonProps = {
  /** O que o botão salva ("Salvar alterações", "Criar pasta", "Enviar"); é a única parte que muda de um uso para outro. */
  children: ReactNode;
  /** Gravação em andamento: mostra o spinner e `savingLabel` e desativa o botão. */
  saving: boolean;
  /** Texto enquanto grava; padrão "Salvando…". */
  savingLabel?: string;
  /** `md` (padrão) é o botão dos formulários; `sm` cabe em avisos e linhas compactas. */
  size?: 'md' | 'sm';
  /** `solid` (padrão) é o botão principal, preenchido; `outline` é a versão de borda, para ações secundárias como "Testar" ao lado de outro campo. */
  variant?: 'solid' | 'outline';
  /** Pulsa para chamar atenção quando há alterações por salvar. */
  attention?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
};

const saveButtonSize = { md: 'min-h-11 px-5', sm: 'min-h-8 px-3' } as const;
const saveButtonVariant = {
  solid: 'border-0 bg-button text-button-text hover:bg-secondary',
  outline: 'border border-control bg-transparent text-text hover:border-accent-fg hover:text-accent-fg',
} as const;

/**
 * Botão padrão de gravar do painel: sempre o mesmo visual e o mesmo comportamento (spinner e texto de "Salvando…"
 * enquanto grava). Use em todo botão que salva, cria ou envia; só o texto, o tamanho, o estilo e o que ele grava mudam.
 *
 *     <SaveButton saving={saving} onClick={() => void save()}>Salvar grupo</SaveButton>
 */
function SaveButton({ children, saving, savingLabel = 'Salvando…', size = 'md', variant = 'solid', attention = false, disabled = false, type = 'button', onClick }: SaveButtonProps) {
  const pulse = attention && !saving && !disabled ? 'animate-save-attention motion-reduce:animate-none' : '';
  return (
    <button
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold ${saveButtonVariant[variant]} ${saveButtonSize[size]} ${saving ? 'cursor-wait opacity-80' : ''} ${pulse}`}
      type={type}
      disabled={saving || disabled}
      aria-busy={saving}
      onClick={onClick}
    >
      {saving ? <><SpinnerIcon />{savingLabel}</> : children}
    </button>
  );
}

export { card, primaryButton, outlineButton, dangerHover, dangerIconButton, memberFormat, GuildIcon, Skeleton, StatusSkeleton, Message, SaveButton };
export { ConstructionIcon, PencilIcon, SpinnerIcon, TrashIcon } from '../../components/icons';
