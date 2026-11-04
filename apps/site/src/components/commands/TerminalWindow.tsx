import type { ReactNode } from 'react';

type TerminalWindowProps = {
  /** Título na barra da janela, só decorativo. */
  title: string;
  /** Nome da região para tecnologia assistiva. */
  label: string;
  children: ReactNode;
  className?: string;
};

/**
 * Janela de terminal (barra com as três bolinhas e um título). É só moldura: o conteúdo é de quem usa, e a janela é
 * escura nos dois temas (tokens `terminal-*`). As bolinhas não são controles.
 *
 *     <TerminalWindow title="kuruttina — comandos" label="Catálogo de comandos">…</TerminalWindow>
 */
function TerminalWindow({ title, label, children, className = '' }: TerminalWindowProps) {
  return (
    <div role="region" aria-label={label} className={`terminal-window flex min-h-0 flex-col overflow-hidden rounded-2xl border border-terminal-border bg-terminal text-terminal-text ${className}`}>
      <div className="relative flex h-11 shrink-0 items-center border-b border-terminal-border bg-terminal-bar px-4" aria-hidden="true">
        <span className="flex gap-2">
          <span className="size-[13px] rounded-full bg-terminal-close" />
          <span className="size-[13px] rounded-full bg-terminal-minimize" />
          <span className="size-[13px] rounded-full bg-terminal-zoom" />
        </span>
        <span className="pointer-events-none absolute inset-x-0 text-center font-mono text-xs text-terminal-muted min-[701px]:text-[13px]">{title}</span>
      </div>
      {children}
    </div>
  );
}

export { TerminalWindow };
