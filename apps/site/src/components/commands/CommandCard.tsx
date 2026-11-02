import type { CatalogCommand } from './command-search';

type CommandCardProps = {
  command: CatalogCommand;
};

function CommandCard({ command }: CommandCardProps) {
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-[14px] border border-border bg-surface p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-mono text-lg font-semibold break-words">{command.slash}</h3>
        <p className="font-mono text-sm break-words text-muted">{command.prefix}</p>
      </div>
      <p className="text-base leading-6 text-text">{command.description}</p>
      {command.permissions.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Permissões necessárias">
          {command.permissions.map((permission) => (
            <li key={permission} className="rounded-full border border-control px-2.5 py-1 text-xs font-semibold text-muted">
              {permission}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-subtle">Sem permissão especial</p>
      )}
      {command.examples.length > 0 ? (
        <details>
          <summary className="cursor-pointer rounded-md text-sm font-semibold text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-fg">
            Exemplos
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {command.examples.map((example, index) => (
              <pre key={index} className="m-0 rounded-[10px] border border-border bg-background p-3 text-sm leading-6 whitespace-pre-wrap break-words text-text">
                <code className="font-mono">{`${example.slash}\n${example.prefix}`}</code>
              </pre>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

export { CommandCard };
