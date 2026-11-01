'use client';

import { useEffect, useRef, useState } from 'react';
import { ErrorMessage } from '../../../../components/ErrorMessage';
import { FloatingNotice } from '../../../../components/FloatingNotice';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { SwitchField } from '../../../../components/Switch';
import { ChannelSelect } from '../../../../components/selectors/ChannelSelect';
import { describeTemplateIssues } from '../../../../components/message-editor/format-issue';
import { MessageEditor } from '../../../../components/message-editor/MessageEditor';
import { errorText, serverUnavailable, sessionExpired } from '../../../../lib/error-messages';
import { card, Message, primaryButton, SaveButton, StatusSkeleton } from '../../ui';
import { listMemberEvents, saveMemberEvent, testMemberEvent, type MemberEvent, type MemberEventErrorCode, type MemberEventKind, type ValidationDetail } from './member-events-api';

/** Modelo que o editor começa quando ainda não há mensagem salva para o evento. */
const DEFAULT_CONTENT: Record<MemberEventKind, string> = {
  join: JSON.stringify({
    content: '{user.mention}',
    embeds: [{ title: 'Bem-vindo(a), {user.name}!', description: '{user.mention} entrou em **{guild.name}**.\nAgora somos {guild.membercount} membros.', thumbnail: { url: '{user.avatar}' } }],
    components: [],
  }),
  leave: JSON.stringify({
    embeds: [{ title: '{user.name} saiu', description: '{user.name} deixou **{guild.name}**.\nAgora somos {guild.membercount} membros.', thumbnail: { url: '{user.avatar}' } }],
    components: [],
  }),
};

const COPY: Record<MemberEventKind, { tab: string; toggle: string; toggleHint: string; ignoreBotsHint: string; editorLabel: string; testHint: string }> = {
  join: {
    tab: 'Entrada',
    toggle: 'Enviar mensagem quando alguém entrar',
    toggleHint: 'O bot avisa no canal escolhido a cada novo membro.',
    ignoreBotsHint: 'Não avisa quando quem entra é outro bot.',
    editorLabel: 'Mensagem de entrada',
    testHint: 'Envia esta mensagem ao canal escolhido, como se você tivesse entrado.',
  },
  leave: {
    tab: 'Saída',
    toggle: 'Enviar mensagem quando alguém sair',
    toggleHint: 'O bot avisa no canal escolhido quando um membro deixa o servidor.',
    ignoreBotsHint: 'Não avisa quando quem sai é outro bot.',
    editorLabel: 'Mensagem de saída',
    testHint: 'Envia esta mensagem ao canal escolhido, como se você tivesse saído.',
  },
};

const EVENTS: MemberEventKind[] = ['join', 'leave'];

/** O que o administrador escolheu para um evento; é o que vai para o servidor ao salvar. */
type Settings = { enabled: boolean; channelId: string; ignoreBots: boolean; contentJson: string };

type TabData = {
  /** Versão gravada; `null` quando o evento ainda não foi salvo. */
  version: number | null;
  /** Último valor salvo, para saber se há alterações por salvar. */
  saved: Settings;
  /** Valor atual do formulário. */
  draft: Settings;
  submitting: boolean;
  /** Mensagem de teste em envio; desativa Testar e Salvar enquanto envia. */
  testing: boolean;
  error: string | null;
};

type Data = Record<MemberEventKind, TabData>;

/** Aviso flutuante no canto da tela; `leaving` começa a animação de saída antes de sumir. */
type Notice = { id: number; leaving: boolean; text: string };

type LoadError = 'unauthenticated' | 'unavailable';

function settingsEqual(a: Settings, b: Settings): boolean {
  return a.enabled === b.enabled && a.channelId === b.channelId && a.ignoreBots === b.ignoreBots && a.contentJson === b.contentJson;
}

function buildData(items: MemberEvent[]): Data {
  const make = (event: MemberEventKind): TabData => {
    const item = items.find((entry) => entry.event === event);
    const settings: Settings = item
      ? { enabled: item.enabled, channelId: item.channelId ?? '', ignoreBots: item.ignoreBots, contentJson: item.contentJson }
      : { enabled: false, channelId: '', ignoreBots: false, contentJson: DEFAULT_CONTENT[event] };
    return { version: item?.version ?? null, saved: settings, draft: settings, submitting: false, testing: false, error: null };
  };
  return { join: make('join'), leave: make('leave') };
}

function saveError(error: MemberEventErrorCode, details?: ValidationDetail[]): string {
  if (error === 'validation') {
    return details && details.length > 0
      ? describeTemplateIssues(details).join('\n')
      : 'A mensagem não é válida. Confira o conteúdo e tente de novo.';
  }
  return errorText(error, {
    channel_required: 'Escolha o canal onde a mensagem será enviada.',
    invalid_channel: 'Esse canal não existe mais neste servidor. Escolha outro.',
    conflict: 'Outra pessoa alterou isso. Recarregue e tente de novo.',
    bot_not_in_guild: 'O bot não está neste servidor.',
    quota: 'Há testes demais na fila. Espere um pouco e tente de novo.',
    not_found: 'Esta configuração não existe mais. Recarregue a página.',
    too_large: 'A mensagem é grande demais.',
    invalid_json: 'Não foi possível salvar a mensagem. Tente de novo.',
    unknown: 'Não foi possível salvar agora. Tente de novo.',
  });
}

/**
 * Entrada e saída: uma aba por evento (entrada e saída de membros), cada uma com interruptor, canal,
 * "Ignorar bots" e a mensagem do bot. Mensagens sem botões ou menus (`allowComponents={false}`).
 */
function MemberEventsView({ guildId }: { guildId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [active, setActive] = useState<MemberEventKind>('join');
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeSeq = useRef(0);
  const noticeId = notice?.id;

  async function load() {
    setLoadError(null);
    const result = await listMemberEvents(guildId);
    if (!result.ok) {
      setLoadError(result.error === 'unauthenticated' ? 'unauthenticated' : 'unavailable');
      return;
    }
    setData(buildData(result.data.items));
  }

  useEffect(() => { void load(); }, [guildId]);

  useEffect(() => {
    if (noticeId === undefined) return undefined;
    const leaveAt = window.setTimeout(() => setNotice((current) => (current && current.id === noticeId ? { ...current, leaving: true } : current)), 2200);
    const clearAt = window.setTimeout(() => setNotice((current) => (current && current.id === noticeId ? null : current)), 2520);
    return () => {
      window.clearTimeout(leaveAt);
      window.clearTimeout(clearAt);
    };
  }, [noticeId]);

  function patchTab(event: MemberEventKind, patch: Partial<TabData>) {
    setData((current) => (current ? { ...current, [event]: { ...current[event], ...patch } } : current));
  }

  function updateDraft(event: MemberEventKind, patch: Partial<Settings>) {
    setData((current) => {
      if (!current) return current;
      const tab = current[event];
      return { ...current, [event]: { ...tab, draft: { ...tab.draft, ...patch }, error: null } };
    });
  }

  function showNotice(text: string) {
    noticeSeq.current += 1;
    setNotice({ id: noticeSeq.current, leaving: false, text });
  }

  async function save(event: MemberEventKind) {
    if (!data) return;
    const { draft, version } = data[event];
    if (draft.enabled && draft.channelId === '') {
      patchTab(event, { error: 'Escolha o canal onde a mensagem será enviada.' });
      return;
    }
    try {
      JSON.parse(draft.contentJson);
    } catch {
      patchTab(event, { error: 'O conteúdo precisa ser um JSON válido.' });
      return;
    }
    patchTab(event, { submitting: true, error: null });
    const result = await saveMemberEvent(guildId, event, {
      expectedVersion: version,
      enabled: draft.enabled,
      channelId: draft.channelId === '' ? null : draft.channelId,
      ignoreBots: draft.ignoreBots,
      contentJson: draft.contentJson,
    });
    if (!result.ok) {
      patchTab(event, { submitting: false, error: saveError(result.error, result.details) });
      return;
    }
    patchTab(event, { version: result.data.version, saved: draft, submitting: false, error: null });
    showNotice('Alterações salvas.');
  }

  /** Envia o rascunho atual como teste, sem precisar salvar antes. */
  async function test(event: MemberEventKind) {
    if (!data) return;
    const { draft } = data[event];
    if (draft.channelId === '') {
      patchTab(event, { error: 'Escolha o canal onde a mensagem será enviada.' });
      return;
    }
    try {
      JSON.parse(draft.contentJson);
    } catch {
      patchTab(event, { error: 'O conteúdo precisa ser um JSON válido.' });
      return;
    }
    patchTab(event, { testing: true, error: null });
    const result = await testMemberEvent(guildId, event, { channelId: draft.channelId, contentJson: draft.contentJson });
    if (!result.ok) {
      patchTab(event, { testing: false, error: saveError(result.error, result.details) });
      return;
    }
    patchTab(event, { testing: false });
    showNotice('Mensagem de teste enviada. Ela chega ao canal em instantes.');
  }

  const header = (
    <>
      <h1 className="text-[28px] font-semibold">Entrada e saída</h1>
      <p className="text-[15px] text-muted">Escolha o canal e a mensagem enviada quando alguém entra ou sai do servidor.</p>
    </>
  );

  const floating = notice ? (
    <FloatingNotice key={notice.id} motionClass={notice.leaving ? 'animate-notice-out' : 'animate-notice-in'}>{notice.text}</FloatingNotice>
  ) : null;

  if (loadError) {
    return (
      <>
        {header}
        <Message
          title="Entrada e saída indisponível"
          action={loadError === 'unauthenticated'
            ? <a className={primaryButton} href="/login">Entrar de novo</a>
            : <button className={primaryButton} type="button" onClick={() => void load()}>Tentar de novo</button>}
        >
          {loadError === 'unauthenticated' ? sessionExpired : serverUnavailable}
        </Message>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        {header}
        <StatusSkeleton label="Carregando entrada e saída" rows={['h-11 w-48', 'h-[360px]']} />
      </>
    );
  }

  const tab = data[active];
  const copy = COPY[active];
  const dirty = !settingsEqual(tab.draft, tab.saved);

  return (
    <>
      {floating}
      {header}

      <SegmentedControl
        label="Evento"
        options={EVENTS.map((event) => ({ value: event, label: COPY[event].tab }))}
        value={active}
        onChange={setActive}
      />

      <div className={`${card} flex flex-col gap-5 p-5`}>
        <SwitchField
          boxed
          label={copy.toggle}
          description={copy.toggleHint}
          checked={tab.draft.enabled}
          disabled={tab.submitting}
          onChange={(enabled) => updateDraft(active, { enabled })}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <ChannelSelect
                key={active}
                guildId={guildId}
                value={tab.draft.channelId}
                onChange={(channelId) => updateDraft(active, { channelId })}
                disabled={tab.submitting}
              />
            </div>
            <SaveButton
              variant="outline"
              saving={tab.testing}
              savingLabel="Enviando…"
              disabled={tab.draft.channelId === '' || tab.submitting}
              onClick={() => void test(active)}
            >
              Testar
            </SaveButton>
          </div>
          <p className="text-sm leading-6 text-muted">{copy.testHint}</p>
        </div>

        <SwitchField
          boxed
          label="Ignorar bots"
          description={copy.ignoreBotsHint}
          checked={tab.draft.ignoreBots}
          disabled={tab.submitting}
          onChange={(ignoreBots) => updateDraft(active, { ignoreBots })}
        />

        <MessageEditor
          key={`${active}-${tab.version ?? 'novo'}`}
          label={copy.editorLabel}
          initialJson={tab.draft.contentJson}
          onChange={(contentJson) => updateDraft(active, { contentJson })}
          allowComponents={false}
        />

        {tab.error ? <ErrorMessage message={tab.error} /> : null}

        <div className="flex flex-wrap gap-3">
          <SaveButton saving={tab.submitting} disabled={tab.testing} attention={dirty} onClick={() => void save(active)}>Salvar</SaveButton>
        </div>
      </div>
    </>
  );
}

export { MemberEventsView };
