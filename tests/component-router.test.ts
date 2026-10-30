import { MessageFlags } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentAction, MessageTemplate } from '@kuruttina/message-templates';
import {
  handleComponentInteraction,
  type ComponentActionPort,
} from '../apps/bot/src/infrastructure/discord/messages/componentRouter.js';
import { runComponentFunctions } from '../apps/bot/src/infrastructure/discord/messages/componentFunctions.js';

vi.mock('../apps/bot/src/infrastructure/discord/messages/componentFunctions.js', () => ({
  runComponentFunctions: vi.fn(async () => undefined),
}));

const emoji = async (name: string): Promise<string> => `[${name}]`;

const simpleTemplate: MessageTemplate = { content: 'Olá!', embeds: [], components: [] };

function makePort(overrides: Partial<ComponentActionPort> = {}): ComponentActionPort {
  return {
    findComponent: vi.fn().mockResolvedValue(null),
    getTemplate: vi.fn().mockResolvedValue(null),
    getButtonConfig: vi.fn().mockResolvedValue(null),
    getSelectConfig: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeButtonInteraction(overrides: Record<string, unknown> = {}) {
  let deferred = false;
  let replied = false;
  const interaction = {
    customId: 'kt:btn:1',
    guildId: '666948364507545600',
    deferred: false,
    replied: false,
    isAnySelectMenu: () => false,
    isButton: () => true,
    user: { id: 'user-1', send: vi.fn().mockResolvedValue(undefined) },
    appPermissions: { has: vi.fn().mockReturnValue(true) },
    message: { delete: vi.fn().mockResolvedValue(undefined) },
    deferUpdate: vi.fn(async () => { deferred = true; interaction.deferred = true; }),
    reply: vi.fn(async (_payload?: unknown) => { replied = true; interaction.replied = true; }),
    update: vi.fn(async () => undefined),
    followUp: vi.fn(async () => undefined),
    ...overrides,
  };
  return interaction;
}

function makeSelectMenuInteraction(overrides: Record<string, unknown> = {}) {
  return {
    customId: 'kt:menu:1',
    guildId: '666948364507545600',
    deferred: false,
    replied: false,
    isAnySelectMenu: () => true,
    isButton: () => false,
    values: ['option-a'],
    message: { components: [{ type: 1, components: [{ type: 3, custom_id: 'kt:s:3-abc', options: [] }] }] },
    reply: vi.fn(async () => undefined),
    followUp: vi.fn(async () => undefined),
    editReply: vi.fn(async (_payload?: unknown) => undefined),
    ...overrides,
  };
}

describe('component router', () => {
  it('replies neutrally outside a guild', async () => {
    const interaction = makeButtonInteraction({ guildId: null });
    const port = makePort();

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: 'Isso só funciona em servidor.' }),
    );
    expect(port.findComponent).not.toHaveBeenCalled();
  });

  it('replies that the action is gone when the component is not found', async () => {
    const interaction = makeButtonInteraction();
    const port = makePort({ findComponent: vi.fn().mockResolvedValue(null) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[search] Essa ação não está mais disponível.' }),
    );
  });

  it('defers select menus with a neutral reply, without resolving the action', async () => {
    const interaction = makeSelectMenuInteraction();
    const port = makePort();

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[ops] Essa opção ainda não está disponível.' }),
    );
    expect(port.findComponent).not.toHaveBeenCalled();
  });

  it('replies with the referenced template on a reply action', async () => {
    const action: ComponentAction = { type: 'reply', template: 'answer', ephemeral: true };
    const interaction = makeButtonInteraction();
    const port = makePort({
      findComponent: vi.fn().mockResolvedValue({ kind: 'button', action }),
      getTemplate: vi.fn().mockResolvedValue({ content: simpleTemplate }),
    });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: 'Olá!', flags: MessageFlags.Ephemeral }),
    );
  });

  it('updates the message on an edit action', async () => {
    const action: ComponentAction = { type: 'edit', template: 'answer' };
    const interaction = makeButtonInteraction();
    const port = makePort({
      findComponent: vi.fn().mockResolvedValue({ kind: 'button', action }),
      getTemplate: vi.fn().mockResolvedValue({ content: simpleTemplate }),
    });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: 'Olá!' }),
    );
  });

  it('deletes the message when the action is delete and permission is present', async () => {
    const action: ComponentAction = { type: 'delete' };
    const interaction = makeButtonInteraction();
    const port = makePort({ findComponent: vi.fn().mockResolvedValue({ kind: 'button', action }) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.deferUpdate).toHaveBeenCalledOnce();
    expect(interaction.message.delete).toHaveBeenCalledOnce();
    expect(interaction.followUp).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[sucess] Pronto. Mensagem apagada.' }),
    );
  });

  it('refuses to delete without the ManageMessages permission', async () => {
    const action: ComponentAction = { type: 'delete' };
    const interaction = makeButtonInteraction({ appPermissions: { has: vi.fn().mockReturnValue(false) } });
    const port = makePort({ findComponent: vi.fn().mockResolvedValue({ kind: 'button', action }) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.message.delete).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: expect.stringContaining('[Angry]') }),
    );
  });

  it('sends a DM and confirms success', async () => {
    const action: ComponentAction = { type: 'dm', template: 'answer' };
    const interaction = makeButtonInteraction();
    const port = makePort({
      findComponent: vi.fn().mockResolvedValue({ kind: 'button', action }),
      getTemplate: vi.fn().mockResolvedValue({ content: simpleTemplate }),
    });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.user.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ content: 'Olá!' }));
    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[sucess] Pronto. Mandei por DM.' }),
    );
  });

  it('reports a closed DM without throwing', async () => {
    const action: ComponentAction = { type: 'dm', template: 'answer' };
    const interaction = makeButtonInteraction({ user: { id: 'user-1', send: vi.fn().mockRejectedValue(new Error('closed')) } });
    const port = makePort({
      findComponent: vi.fn().mockResolvedValue({ kind: 'button', action }),
      getTemplate: vi.fn().mockResolvedValue({ content: simpleTemplate }),
    });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: expect.stringContaining('[ops]') }),
    );
  });

  it('replies that the template is gone when the referenced template no longer exists', async () => {
    const action: ComponentAction = { type: 'reply', template: 'gone' };
    const interaction = makeButtonInteraction();
    const port = makePort({
      findComponent: vi.fn().mockResolvedValue({ kind: 'button', action }),
      getTemplate: vi.fn().mockResolvedValue(null),
    });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[search] O template desta ação não existe mais.' }),
    );
  });

  it('reports an unexpected failure with a generic message', async () => {
    const interaction = makeButtonInteraction();
    const port = makePort({ findComponent: vi.fn().mockRejectedValue(new Error('boom')) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: expect.stringContaining('[error]') }),
    );
  });

  it('refuses to process beyond the concurrency limit', async () => {
    const port = makePort({
      findComponent: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return null;
      }),
    });
    const interactions = Array.from({ length: 65 }, () => makeButtonInteraction());

    await Promise.all(interactions.map((interaction) => handleComponentInteraction(interaction as never, port, emoji)));

    const busyReplies = interactions.filter((interaction) =>
      vi.mocked(interaction.reply).mock.calls.some(([payload]) =>
        typeof payload === 'object' && payload !== null && 'content' in payload &&
        (payload as { content: string }).content.includes('Já estou ocupada'),
      ),
    );
    expect(busyReplies.length).toBeGreaterThan(0);
  });
});

describe('component router com Component de botão', () => {
  beforeEach(() => {
    vi.mocked(runComponentFunctions).mockClear();
  });

  it('resolve o Component pelo custom_id e roda as funções dele', async () => {
    const functions = [{ type: 'send_message', config: { template: 'answer', ephemeral: true } }];
    const interaction = makeButtonInteraction({ customId: 'kt:c:7-abc' });
    const port = makePort({
      getButtonConfig: vi.fn().mockResolvedValue({ id: 7, name: 'Botão', functions }),
    });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(port.getButtonConfig).toHaveBeenCalledExactlyOnceWith('666948364507545600', 7);
    expect(port.findComponent).not.toHaveBeenCalled();
    expect(runComponentFunctions).toHaveBeenCalledExactlyOnceWith(interaction, functions, {
      getTemplate: port.getTemplate,
      emoji,
    });
  });

  it('replies that the action is gone when the Component no longer exists', async () => {
    const interaction = makeButtonInteraction({ customId: 'kt:c:7-abc' });
    const port = makePort({ getButtonConfig: vi.fn().mockResolvedValue(null) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[search] Essa ação não está mais disponível.' }),
    );
    expect(runComponentFunctions).not.toHaveBeenCalled();
  });

  it('only acknowledges the click when the Component has no functions', async () => {
    const interaction = makeButtonInteraction({ customId: 'kt:c:7-abc' });
    const port = makePort({
      getButtonConfig: vi.fn().mockResolvedValue({ id: 7, name: 'Vazio', functions: [] }),
    });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.deferUpdate).toHaveBeenCalledOnce();
    expect(runComponentFunctions).not.toHaveBeenCalled();
  });

  it('keeps resolving legacy kt:b custom_ids through message_components', async () => {
    const action: ComponentAction = { type: 'reply', template: 'answer' };
    const interaction = makeButtonInteraction({ customId: 'kt:b:abc' });
    const port = makePort({
      findComponent: vi.fn().mockResolvedValue({ kind: 'button', action }),
      getTemplate: vi.fn().mockResolvedValue({ content: simpleTemplate }),
    });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(port.getButtonConfig).not.toHaveBeenCalled();
    expect(port.findComponent).toHaveBeenCalledExactlyOnceWith('666948364507545600', 'kt:b:abc');
    expect(runComponentFunctions).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ content: 'Olá!' }));
  });
});

describe('component router com Component de menu', () => {
  const SELECT_ID_MENU = 'kt:s:3-abc';
  const keyedConfig = (keepSelection: boolean) => ({
    id: 3,
    name: 'Cargos',
    keepSelection,
    options: [
      { key: 'k1abc234', label: 'Azul', functions: [{ type: 'send_message', config: { template: 'ok' } }] },
      { key: 'z9zzz999', label: 'Verde', functions: [{ type: 'edit_message', config: { template: 'ok' } }] },
    ],
  });

  beforeEach(() => {
    vi.mocked(runComponentFunctions).mockClear();
  });

  it('roda as funções da opção cuja chave vem antes do : no valor escolhido', async () => {
    const config = keyedConfig(true);
    const interaction = makeSelectMenuInteraction({ customId: SELECT_ID_MENU, values: ['k1abc234:0'] });
    const port = makePort({ getSelectConfig: vi.fn().mockResolvedValue(config) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(port.getSelectConfig).toHaveBeenCalledExactlyOnceWith('666948364507545600', 3);
    expect(runComponentFunctions).toHaveBeenCalledExactlyOnceWith(interaction, config.options[0]?.functions, {
      getTemplate: port.getTemplate,
      emoji,
    });
  });

  it('concatena as funções das opções escolhidas na ordem dos valores e ignora valor sem opção', async () => {
    const config = keyedConfig(true);
    const interaction = makeSelectMenuInteraction({
      customId: SELECT_ID_MENU,
      values: ['z9zzz999:1', 'naoexiste:7', 'k1abc234:0'],
    });
    const port = makePort({ getSelectConfig: vi.fn().mockResolvedValue(config) });

    await handleComponentInteraction(interaction as never, port, emoji);

    const expected = [...(config.options[1]?.functions ?? []), ...(config.options[0]?.functions ?? [])];
    expect(runComponentFunctions).toHaveBeenCalledExactlyOnceWith(interaction, expected, {
      getTemplate: port.getTemplate,
      emoji,
    });
  });

  it('replies that the option is gone when no value matches an option', async () => {
    const interaction = makeSelectMenuInteraction({ customId: SELECT_ID_MENU, values: ['naoexiste:0'] });
    const port = makePort({ getSelectConfig: vi.fn().mockResolvedValue(keyedConfig(true)) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[ops] Essa opção não está mais disponível.' }),
    );
    expect(runComponentFunctions).not.toHaveBeenCalled();
  });

  it('replies that the option is gone when the menu Component no longer exists', async () => {
    const interaction = makeSelectMenuInteraction({ customId: SELECT_ID_MENU, values: ['k1abc234:0'] });
    const port = makePort({ getSelectConfig: vi.fn().mockResolvedValue(null) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[search] Essa opção não está mais disponível.' }),
    );
    expect(runComponentFunctions).not.toHaveBeenCalled();
  });

  it('reedita o menu com os próprios componentes quando keepSelection é false', async () => {
    const interaction = makeSelectMenuInteraction({ customId: SELECT_ID_MENU, values: ['k1abc234:0'] });
    const port = makePort({ getSelectConfig: vi.fn().mockResolvedValue(keyedConfig(false)) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith({ components: interaction.message.components });
  });

  it('mantém a seleção quando keepSelection é true', async () => {
    const interaction = makeSelectMenuInteraction({ customId: SELECT_ID_MENU, values: ['k1abc234:0'] });
    const port = makePort({ getSelectConfig: vi.fn().mockResolvedValue(keyedConfig(true)) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it('não reedita o menu quando a escolha edita ou apaga a mensagem', async () => {
    const interaction = makeSelectMenuInteraction({ customId: SELECT_ID_MENU, values: ['z9zzz999:1'] });
    const port = makePort({ getSelectConfig: vi.fn().mockResolvedValue(keyedConfig(false)) });

    await handleComponentInteraction(interaction as never, port, emoji);

    expect(runComponentFunctions).toHaveBeenCalledOnce();
    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it('falha ao reeditar o menu vira log e não lança', async () => {
    const interaction = makeSelectMenuInteraction({
      customId: SELECT_ID_MENU,
      values: ['k1abc234:0'],
      editReply: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const port = makePort({ getSelectConfig: vi.fn().mockResolvedValue(keyedConfig(false)) });

    await expect(handleComponentInteraction(interaction as never, port, emoji)).resolves.toBeUndefined();
    expect(interaction.editReply).toHaveBeenCalledOnce();
  });
});
