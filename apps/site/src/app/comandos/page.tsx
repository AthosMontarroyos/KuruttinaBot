import { useState } from 'react';
import { CommandCard } from '../../components/commands/CommandCard';
import { ALL_TOPICS, commandCount, filterCommandGroups, publicTopics } from '../../components/commands/command-search';
import { MatrixRain } from '../../components/commands/MatrixRain';
import { TerminalWindow } from '../../components/commands/TerminalWindow';
import { TopicFilter, type TopicOption } from '../../components/commands/TopicFilter';
import { SearchIcon } from '../../components/icons';

const topicOptions: TopicOption[] = [
  { id: ALL_TOPICS, label: 'Todos', count: commandCount(ALL_TOPICS) },
  ...publicTopics.map((topic) => ({ id: topic.id, label: topic.label, count: commandCount(topic.id) })),
];

/**
 * Catálogo de comandos. A página cabe na tela (quem monta o layout dá a altura): o título e os tópicos ficam no topo e só a
 * lista dentro da janela de terminal rola. No celular não há barra superior; a navegação é a roleta (`WheelMenu`).
 */
function ComandosPage() {
  const [query, setQuery] = useState('');
  const [topicId, setTopicId] = useState<string>(ALL_TOPICS);
  const groups = filterCommandGroups(query, topicId);
  const total = groups.reduce((sum, group) => sum + group.commands.length, 0);

  return (
    <main id="conteudo" className="flex min-h-0 flex-1 flex-col px-5 pt-7 pb-5 min-[701px]:px-[5%] min-[701px]:pt-2 min-[701px]:pb-8">
      <MatrixRain />
      <div className="flex shrink-0 flex-col gap-3.5 pb-4 min-[1101px]:gap-5 min-[1101px]:pb-[22px]">
        <header className="flex flex-col items-start gap-1.5 min-[1101px]:flex-row min-[1101px]:items-end min-[1101px]:justify-between min-[1101px]:gap-8">
          <h1 className="home-title -ml-[3px] font-display text-[52px] leading-none font-medium tracking-[-0.04em] min-[701px]:text-[64px] min-[1101px]:text-[84px]">
            Comandos<span className="text-accent">.</span>
          </h1>
          <p className="max-w-[46ch] text-[15px] leading-[1.45] text-muted min-[701px]:text-[19px] min-[1101px]:mb-2">
            Todos os comandos funcionam com a barra (/) e com o prefixo k!. Use o que preferir.
          </p>
        </header>
        <TopicFilter options={topicOptions} value={topicId} onChange={setTopicId} />
      </div>

      <TerminalWindow title="kuruttina — comandos" label="Catálogo de comandos" className="flex-1">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-terminal-line px-4 py-3 min-[701px]:px-7 min-[701px]:py-4">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-terminal-control bg-terminal-text/[0.06] px-4 text-terminal-muted focus-within:border-terminal-accent min-[701px]:max-w-[480px]">
            <span className="sr-only">Buscar comando</span>
            <SearchIcon />
            <input
              className="min-w-0 flex-1 bg-transparent text-base text-terminal-text outline-none placeholder:text-terminal-subtle"
              type="search"
              placeholder="Nome, descrição ou tópico"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p role="status" className="hidden shrink-0 text-sm text-terminal-subtle min-[701px]:block">
            {total === 1 ? '1 comando' : `${total} comandos`}
          </p>
        </div>

        <div className="terminal-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-24 min-[701px]:px-7 min-[701px]:pb-10" tabIndex={0} role="region" aria-label="Lista de comandos">
          {groups.length === 0 ? (
            <p role="status" className="pt-6 text-base text-terminal-muted">
              Nenhum comando encontrado.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.topic.id} aria-labelledby={`topico-${group.topic.id}`}>
                <header className="sticky top-0 z-[2] flex flex-col gap-0.5 bg-terminal pt-[22px] pb-3">
                  <h2 id={`topico-${group.topic.id}`} className="text-[22px] leading-[1.2] font-semibold min-[701px]:text-[26px]">
                    {group.topic.label}
                  </h2>
                  <p className="text-[15px] text-terminal-muted">{group.topic.description}</p>
                </header>
                <div className="grid grid-cols-1 items-start gap-4 min-[701px]:grid-cols-2">
                  {group.commands.map((command) => (
                    <CommandCard key={command.id} command={command} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </TerminalWindow>
    </main>
  );
}

export { ComandosPage };
