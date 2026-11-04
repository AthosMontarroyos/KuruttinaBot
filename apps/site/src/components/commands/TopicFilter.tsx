import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from '../icons';
import { topicBackground, topicVisual } from './topic-visuals';

type TopicOption = { id: string; label: string; count: number };

type TopicFilterProps = {
  options: readonly TopicOption[];
  value: string;
  onChange: (topicId: string) => void;
};

const chip = 'inline-flex h-[52px] items-center gap-2.5 rounded-2xl text-base font-semibold motion-reduce:transition-none';

type TopicChipProps = { option: TopicOption; selected: boolean; onSelect: () => void; full?: boolean };

/** Um tópico: gradiente da cor dele; o selecionado fica cheio, com borda forte e um "feito", então não depende só da cor. */
function TopicChip({ option, selected, onSelect, full = false }: TopicChipProps) {
  const { token, Icon } = topicVisual(option.id);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`${chip} ${full ? 'w-full' : ''} ${selected ? 'border-2 border-accent-fg px-4 text-button-text' : 'border border-control bg-surface px-[17px] text-text hover:border-text'}`}
      style={{ backgroundImage: topicBackground(token, selected) }}
    >
      <Icon className="size-5" />
      {option.label}
      <span className={`grid h-6 min-w-6 place-items-center rounded-lg px-1.5 text-[13px] font-bold ${full ? 'ml-auto' : ''} ${selected ? 'bg-button-text/15' : 'bg-text/10'}`} aria-hidden="true">
        {option.count}
      </span>
      {selected ? <CheckIcon /> : null}
    </button>
  );
}

/**
 * Escolha do tópico dos comandos. A partir de 1101px são chips lado a lado, em linha própria; abaixo disso (inclusive com
 * zoom) vira um botão com o tópico atual que abre a lista, porque uma fileira de chips não cabe e quebraria desalinhada.
 *
 *     <TopicFilter options={options} value={topicId} onChange={setTopicId} />
 */
function TopicFilter({ options, value, onChange }: TopicFilterProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent): void => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!current) return null;
  const { token, Icon } = topicVisual(current.id);

  return (
    <>
      <div role="group" aria-label="Filtrar por tópico" className="hidden flex-wrap gap-3 min-[1101px]:flex">
        {options.map((option) => (
          <TopicChip key={option.id} option={option} selected={option.id === value} onSelect={() => onChange(option.id)} />
        ))}
      </div>

      <div ref={root} className="relative w-full max-w-[420px] min-[1101px]:hidden max-[700px]:max-w-none">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={`Filtrar por tópico: ${current.label}`}
          onClick={() => setOpen((state) => !state)}
          className={`${chip} w-full border-2 border-accent-fg px-4 text-button-text`}
          style={{ backgroundImage: topicBackground(token, true) }}
        >
          <Icon className="size-5" />
          <span className="flex-1 text-left">{current.label}</span>
          <span className="grid h-6 min-w-6 place-items-center rounded-lg bg-button-text/15 px-1.5 text-[13px] font-bold" aria-hidden="true">
            {current.count}
          </span>
          <ChevronDownIcon className={`size-5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </button>
        {open ? (
          <div role="group" aria-label="Filtrar por tópico" className="absolute inset-x-0 top-[calc(100%+8px)] z-10 flex flex-col gap-2 rounded-[18px] border border-control bg-background p-2.5">
            {options.map((option) => (
              <TopicChip
                key={option.id}
                option={option}
                selected={option.id === value}
                full
                onSelect={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

export { TopicFilter };
export type { TopicOption };
