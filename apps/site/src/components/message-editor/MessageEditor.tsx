'use client';

import { useState, type ReactNode } from 'react';
import { EmbedCard, InlineText } from './EmbedCard';
import { ActionRows } from './ActionRows';
import { TemplateGuide } from './TemplateGuide';
import { PreviewProvider } from './preview-values';
import { ChatMessage, MessagePreview } from './ChatMessagePreview';
import { LIMITS, emptyEmbed, isSavedRow, parseState, record, toTemplate, type EditorState } from './message-model';

type MessageEditorProps = {
  /** JSON do modelo de mensagem (`{ content?, embeds, components }`) com que o editor começa; vazio para uma mensagem nova. */
  initialJson: string;
  /** Recebe o JSON do modelo a cada alteração, pronto para enviar ao servidor. */
  onChange: (json: string) => void;
  /** Título acima da mensagem; padrão "Mensagem". */
  label?: string;
  /** Mostra a aba JSON (modo avançado); padrão `true`. A aba Variáveis aparece sempre. */
  allowJson?: boolean;
  /** Conteúdo da aba Enviar, à direita de Variáveis; sem ele a aba não aparece. */
  sendPanel?: ReactNode;
};

/**
 * Editor visual: a própria mensagem do bot, como aparece no Discord, é editada no lugar.
 *
 * O valor é lido só ao montar. Para trocar de mensagem (ou quando ela chega depois de carregar),
 * remonte o editor com outra `key`:
 *
 *     <MessageEditor key={name} initialJson={json} onChange={setJson} label="Mensagem de boas-vindas" />
 */
function MessageEditor({ initialJson, onChange, label = 'Mensagem', allowJson = true, sendPanel }: MessageEditorProps) {
  const [initial] = useState(() => parseState(initialJson));
  const [mode, setMode] = useState<'visual' | 'json'>(initial ? 'visual' : 'json');
  const [state, setState] = useState<EditorState>(initial ?? { content: '', embeds: [], components: [] });
  const [rawJson, setRawJson] = useState(initialJson);
  const [modeError, setModeError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'variables' | 'send' | null>(null);

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

  const openVisual = () => {
    setPanel(null);
    if (mode !== 'visual') showVisual();
  };

  const openJson = () => {
    setPanel(null);
    if (mode !== 'json') showJson();
  };

  const tab = (active: boolean) => `rounded-[8px] px-3 py-1 text-sm font-medium ${active ? 'bg-border text-text' : 'text-muted hover:text-text'}`;
  const rowsFull = state.components.length >= LIMITS.actionRows;

  return (
    <PreviewProvider>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex gap-1" role="group" aria-label="Modo de edição">
            <button type="button" className={tab(panel === null && mode === 'visual')} aria-pressed={panel === null && mode === 'visual'} onClick={openVisual}>Visual</button>
            {allowJson ? <button type="button" className={tab(panel === null && mode === 'json')} aria-pressed={panel === null && mode === 'json'} onClick={openJson}>JSON</button> : null}
            <button type="button" className={tab(panel === 'variables')} aria-pressed={panel === 'variables'} onClick={() => setPanel('variables')}>Variáveis</button>
            {sendPanel ? <button type="button" className={tab(panel === 'send')} aria-pressed={panel === 'send'} onClick={() => setPanel('send')}>Enviar</button> : null}
          </div>
        </div>
        {modeError ? <p role="alert" className="text-sm text-red-600">{modeError}</p> : null}
        {panel === 'variables' ? (
          <TemplateGuide />
        ) : panel === 'send' ? (
          sendPanel
        ) : mode === 'json' ? (
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
            <ActionRows rows={state.components} onChange={(components) => update({ ...state, components })} />
            <div className="flex flex-wrap gap-2 self-start">
              {state.embeds.length < LIMITS.embeds ? (
                <button type="button" className="self-start rounded border border-dashed border-[#4e5058] px-3 py-1 text-sm text-[#b5bac1] hover:bg-white/5 hover:text-white" onClick={() => update({ ...state, embeds: [...state.embeds, emptyEmbed()] })}>+ Adicionar embed</button>
              ) : null}
              <button
                type="button"
                disabled={rowsFull}
                title={rowsFull ? 'Máximo de 5 linhas' : undefined}
                className="rounded border border-dashed border-[#4e5058] px-3 py-1 text-sm text-[#b5bac1] hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#b5bac1]"
                onClick={() => update({ ...state, components: [...state.components, { kind: 'pending' }] })}
              >
                + Action Row
              </button>
            </div>
          </ChatMessage>
        )}
        {panel === null && mode === 'visual' && state.components.some((row) => isSavedRow(row) && record(row).kind !== 'buttons' && record(row).kind !== 'select') ? <p className="text-[13px] text-muted">Linhas de formato desconhecido só podem ser editadas no modo JSON.</p> : null}
      </div>
    </PreviewProvider>
  );
}

export { MessageEditor, MessagePreview };
export type { MessageEditorProps };
