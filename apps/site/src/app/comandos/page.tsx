import { useState } from 'react';
import { CommandCard } from '../../components/commands/CommandCard';
import { ALL_TOPICS, filterCommandGroups, publicTopics } from '../../components/commands/command-search';

const topicOptions = [{ id: ALL_TOPICS, label: 'Todos', description: '' }, ...publicTopics];

function ComandosPage() {
  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState<string>(ALL_TOPICS);
  const groups = filterCommandGroups(query, topicId);

  return (
    <main id="conteudo" className="flex min-h-0 flex-col gap-8 px-5 pt-3 pb-8 min-[701px]:px-[5%] min-[701px]:pt-12 min-[701px]:pb-[88px]">
      <header className="flex flex-col gap-4">
        <h1 className="text-[40px] leading-[1.2] font-semibold min-[701px]:text-[52px]">Comandos</h1>
        <p className="max-w-[60ch] text-base leading-6 text-muted min-[701px]:text-lg">
          Todos os comandos funcionam com a barra (/) e com o prefixo k!. Use o que preferir.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="busca-comandos">
            Buscar comando
          </label>
          <input
            id="busca-comandos"
            className="w-full rounded-[12px] border border-border bg-surface px-4 py-3 text-base text-text placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg min-[701px]:max-w-[480px]"
            type="search"
            placeholder="Nome, descrição ou tópico"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div role="group" aria-label="Filtrar por tópico" className="flex flex-wrap gap-2">
          {topicOptions.map((option) => {
            const selected = topicId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTopicId(option.id)}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors motion-reduce:transition-none ${selected ? 'border-button bg-accent-soft text-accent-fg' : 'border-control bg-surface text-muted hover:border-text hover:text-text'}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <p role="status" className="text-base text-muted">
          Nenhum comando encontrado.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.topic.id} aria-labelledby={`topico-${group.topic.id}`} className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
              <h2 id={`topico-${group.topic.id}`} className="text-2xl font-semibold min-[701px]:text-[28px]">
                {group.topic.label}
              </h2>
              <p className="text-base text-muted">{group.topic.description}</p>
            </header>
            <div className="grid grid-cols-1 gap-4 min-[701px]:grid-cols-2">
              {group.commands.map((command) => (
                <CommandCard key={command.id} command={command} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}

export { ComandosPage };
