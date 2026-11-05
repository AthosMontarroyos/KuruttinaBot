import { splitExample } from '../../lib/command-example';
import { ChevronDownIcon } from '../icons';
import type { CatalogCommand } from './command-search';

type CommandCardProps = {
  command: CatalogCommand;
};

type ExampleLineProps = { text: string; name: string };

/** Uma forma de usar o command (barra ou prefixo), com o nome em destaque. */
function ExampleLine({ text, name }: ExampleLineProps) {
  const { name: head, rest } = splitExample(text, name);
  return (
    <>
      <span className="font-bold text-terminal-accent">{head}</span>
      {rest}
    </>
  );
}

/** Cartão de um command, para dentro da janela de terminal (cores `terminal-*`). Os exemplos abrem num `<details>`. */
function CommandCard({ command }: CommandCardProps) {
  return (
    <article className="flex min-w-0 flex-col gap-3.5 rounded-[14px] border border-terminal-line bg-terminal-text/[0.045] p-5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="font-mono text-lg font-bold break-words text-terminal-accent">{command.slash}</h3>
        <p className="font-mono text-sm break-words text-terminal-muted">{command.prefix}</p>
      </div>
      <p className="text-base leading-6 text-terminal-text">{command.description}</p>
      {command.permissions.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Permissões necessárias">
          {command.permissions.map((permission) => (
            <li key={permission} className="rounded-full border border-terminal-control px-[11px] py-[3px] text-[13px] font-semibold text-terminal-muted">
              {permission}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-terminal-subtle">Sem permissão especial</p>
      )}
      {command.examples.length > 0 ? (
        <details className="group">
          <summary className="-my-2 -ml-1 inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-terminal-accent hover:text-terminal-text [&::-webkit-details-marker]:hidden">
            Exemplos
            <ChevronDownIcon className="size-[18px] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {command.examples.map((example, index) => (
              <pre key={index} className="m-0 rounded-[10px] border border-terminal-line bg-terminal-code px-3.5 py-2.5 text-[13.5px] leading-[1.75] whitespace-pre-wrap break-words text-terminal-text">
                <code className="font-mono">
                  <ExampleLine text={example.slash} name={command.slash} />
                  {'\n'}
                  <ExampleLine text={example.prefix} name={command.prefix} />
                </code>
              </pre>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

export { CommandCard };
