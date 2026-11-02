import { MessageFlags, SlashCommandBuilder, type Interaction } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { CommandsHandler } from '../apps/bot/src/command-system/CommandsHandler.js';
import { buildHelpPage, helpCustomId } from '../apps/bot/src/command-system/helpReply.js';
import type { ChatInputCommand, CommandReply } from '../apps/bot/src/command-system/types.js';
import { handleInteractionCreate } from '../apps/bot/src/events/interactions/interactionCreate.js';
import type { ComponentActionPort } from '../apps/bot/src/infrastructure/discord/messages/componentRouter.js';

const OWNER = '666948364507545600';
const OTHER = '111222333444555666';

function utilityCommand(name: string): ChatInputCommand {
  return {
    data: new SlashCommandBuilder().setName(name).setDescription(`Comando ${name}`),
    access: { kind: 'public' },
    help: { topic: 'utility', examples: [{ slash: `/${name}`, prefix: `k!${name}` }] },
    scope: 'global',
    execute: async () => undefined,
  };
}

/** 8 comandos de utilidades: visão geral + 2 blocos, total de 3 páginas. */
function helpHandler(): CommandsHandler {
  return new CommandsHandler(Array.from({ length: 8 }, (_, index) => utilityCommand(`util${index}`)));
}

/** Botão falso: sem emoji resolvido, o `book` e o `Disappointed` caem no fallback Unicode. */
function buttonInteraction(customId: string, userId: string) {
  return {
    isChatInputCommand: () => false,
    isButton: () => true,
    isAnySelectMenu: () => false,
    customId,
    id: 'interaction-id',
    guildId: undefined,
    user: { id: userId },
    client: {
      application: { emojis: { fetch: vi.fn(async () => ({ find: () => undefined })) } },
      ws: { ping: 84 },
    },
    deferred: false,
    replied: false,
    update: vi.fn(async (_payload: unknown) => undefined),
    reply: vi.fn(async (_payload: unknown) => undefined),
    followUp: vi.fn(async (_payload: unknown) => undefined),
    deferUpdate: vi.fn(async () => undefined),
  };
}

describe('help navigation button', () => {
  it('updates the message with the requested page for the owner', async () => {
    const handler = helpHandler();
    const interaction = buttonInteraction(helpCustomId(1, OWNER), OWNER);

    await handleInteractionCreate(interaction as unknown as Interaction, handler);

    const expected = buildHelpPage(handler.catalog(), 1, OWNER, { book: '📖' }) as Exclude<CommandReply, string>;
    expect(expected).toMatchObject({ embeds: [{ footer: { text: 'Página 2/3' } }] });
    expect(interaction.update).toHaveBeenCalledExactlyOnceWith({ ...expected, allowedMentions: { parse: [] } });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('answers ephemerally and does not update for another user', async () => {
    const handler = helpHandler();
    const interaction = buttonInteraction(helpCustomId(1, OWNER), OTHER);

    await handleInteractionCreate(interaction as unknown as Interaction, handler);

    expect(interaction.update).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith({
      content: '😞 Só quem abriu esta ajuda pode navegar por ela. Use **/help** para abrir a sua.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('answers with an ephemeral error when the update fails', async () => {
    const handler = helpHandler();
    const interaction = buttonInteraction(helpCustomId(1, OWNER), OWNER);
    interaction.update = vi.fn().mockRejectedValue(new Error('Discord unavailable'));

    await expect(handleInteractionCreate(interaction as unknown as Interaction, handler)).resolves.toBeUndefined();

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith({
      content: '❌ Não consegui trocar a página da ajuda. Use **/help** de novo.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it.each(['kt:help:noop', 'kt:help:x:' + OWNER, 'kt:b:legacy-button'])('does not trigger the help handler for %j', async (customId) => {
    const handler = helpHandler();
    const interaction = buttonInteraction(customId, OWNER);

    await handleInteractionCreate(interaction as unknown as Interaction, handler);

    expect(interaction.update).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.client.application.emojis.fetch).not.toHaveBeenCalled();
  });

  it('leaves other component custom ids to the component router', async () => {
    const handler = helpHandler();
    const interaction = buttonInteraction('kt:c:1-abc', OWNER);
    const componentPort = {
      findComponent: vi.fn(),
      getTemplate: vi.fn(),
      getButtonConfig: vi.fn(),
      getSelectConfig: vi.fn(),
    } as unknown as ComponentActionPort;

    await handleInteractionCreate(interaction as unknown as Interaction, handler, componentPort);

    expect(interaction.update).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      content: 'Isso só funciona em servidor.',
      flags: MessageFlags.Ephemeral,
    }));
  });
});
