import type { ComponentType } from 'react';
import { GlobeIcon, GridIcon, ShieldIcon, SlidersIcon, SparkleIcon } from '../icons';
import { ALL_TOPICS } from './command-search';

type TopicVisual = {
  /** Sufixo dos tokens `--color-topic-<token>-from` e `-to` em `globals.css`. */
  token: string;
  Icon: ComponentType<{ className?: string }>;
};

/** Cor e ícone de cada tópico. Tópico novo sem entrada aqui usa o visual de "Todos". */
const topicVisuals: Record<string, TopicVisual> = {
  [ALL_TOPICS]: { token: 'all', Icon: GridIcon },
  public: { token: 'public', Icon: GlobeIcon },
  utility: { token: 'utility', Icon: SlidersIcon },
  fun: { token: 'fun', Icon: SparkleIcon },
  mod: { token: 'mod', Icon: ShieldIcon },
};

function topicVisual(topicId: string): TopicVisual {
  return topicVisuals[topicId] ?? (topicVisuals[ALL_TOPICS] as TopicVisual);
}

/** Selecionado: gradiente cheio. Não selecionado: o mesmo gradiente bem suave sobre a superfície. */
function topicBackground(token: string, selected: boolean): string {
  const from = `var(--color-topic-${token}-from)`;
  const to = `var(--color-topic-${token}-to)`;
  if (selected) return `linear-gradient(135deg, ${from}, ${to})`;
  return `linear-gradient(135deg, color-mix(in srgb, ${from} 33%, transparent), color-mix(in srgb, ${to} 33%, transparent))`;
}

export { topicBackground, topicVisual };
