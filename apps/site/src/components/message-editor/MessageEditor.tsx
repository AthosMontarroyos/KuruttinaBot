'use client';

import { useState } from 'react';
import { EmbedCard, InlineText } from './EmbedCard';
import { ComponentsPreview } from './ComponentsPreview';
import { ChatMessage, MessagePreview } from './ChatMessagePreview';
import { LIMITS, emptyEmbed, parseState, toTemplate, type EditorState } from './message-model';

type MessageEditorProps = {
  /** JSON do modelo de mensagem (`{ content?, embeds, components }`) com que o editor começa; vazio para uma mensagem nova. */
  initialJson: string;
  /** Recebe o JSON do modelo a cada alteração, pronto para enviar ao servidor. */
  onChange: (json: string) => void;
  /** Título acima da mensagem; padrão "Mensagem". */
  label?: string;
  /** Mostra a aba JSON (modo avançado); padrão `true`. */
  allowJson?: boolean;
};

/**
 * Editor visual: a própria mensagem do bot, como aparece no Discord, é editada no lugar.
 *
 * O valor é lido só ao montar. Para trocar de mensagem (ou quando ela chega depois de carregar),
 * remonte o editor com outra `key`:
 *
 *     <MessageEditor key={name} initialJson={json} onChange={setJson} label="Mensagem de boas-vindas" />
 */
function MessageEditor({ initialJson, onChange, label = 'Mensagem', allowJson = true }: MessageEditorProps) {
  const [initial] = useState(() => parseState(initialJson));
  const [mode, setMode] = useState<'visual' | 'json'>(initial ? 'visual' : 'json');
  const [state, setState] = useState<EditorState>(initial ?? { content: '', embeds: [], components: [] });
  const [rawJson, setRawJson] = useState(initialJson);
  const [modeError, setModeError] = useState<string | null>(null);

  const update = (next: EditorState) => {
    setState(next);
    onChange(JSON.stringify(toTemplate(next)));
  };

  const showJson = () => {
    setRawJson(JSON.stringify(toTemplate(state), null, 2));
    setModeError(null);
    setMode('json');
  };

  const showVisual = () => {
    const parsed = parseState(rawJson);
    if (!parsed) {
      setModeError('Corrija o JSON antes de voltar ao modo visual.');
      return;
    }
    setModeError(null);
    update(parsed);
    setMode('visual');
  };

  const tab = (active: boolean) => `rounded-[8px] px-3 py-1 text-sm font-medium ${active ? 'bg-border text-text' : 'text-muted hover:text-text'}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {allowJson ? (
          <div className="flex gap-1" role="group" aria-label="Modo de edição">
            <button type="button" className={tab(mode === 'visual')} aria-pressed={mode === 'visual'} onClick={mode === 'visual' ? undefined : showVisual}>Visual</button>
            <button type="button" className={tab(mode === 'json')} aria-pressed={mode === 'json'} onClick={mode === 'json' ? undefined : showJson}>JSON</button>
          </div>
        ) : null}
      </div>
      {modeError ? <p role="alert" className="text-sm text-red-600">{modeError}</p> : null}
      {mode === 'json' ? (
        <textarea
          aria-label="Conteúdo em JSON"
          className="min-h-[320px] rounded-[10px] border border-control bg-transparent px-3 py-2 font-mono text-[13px] leading-5"
          value={rawJson}
          onChange={(event) => {
            setRawJson(event.target.value);
            onChange(event.target.value);
          }}
        />
      ) : (
        <ChatMessage>
          <InlineText rich label="Texto da mensagem" placeholder="Escreva a mensagem" maxLength={LIMITS.content} value={state.content} onChange={(content) => update({ ...state, content })} />
          {state.embeds.map((embed, index) => (
            <EmbedCard
              key={embed.key}
              embed={embed}
              index={index}
              onChange={(next) => update({ ...state, embeds: state.embeds.map((item) => (item.key === embed.key ? next : item)) })}
              onRemove={() => update({ ...state, embeds: state.embeds.filter((item) => item.key !== embed.key) })}
            />
          ))}
          <ComponentsPreview rows={state.components} />
          {state.embeds.length < LIMITS.embeds ? (
            <button type="button" className="self-start rounded border border-dashed border-[#4e5058] px-3 py-1 text-sm text-[#b5bac1] hover:bg-white/5 hover:text-white" onClick={() => update({ ...state, embeds: [...state.embeds, emptyEmbed()] })}>+ Adicionar embed</button>
          ) : null}
        </ChatMessage>
      )}
      {mode === 'visual' && state.components.length > 0 ? <p className="text-[13px] text-muted">Edite os botões e menus no modo JSON.</p> : null}
    </div>
  );
}

export { MessageEditor, MessagePreview };
export type { MessageEditorProps };
