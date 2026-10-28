import {
  MessageFlags,
  PermissionsBitField,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type InteractionReplyOptions,
} from 'discord.js';
import type { ComponentAction, MessageTemplate } from '@kuruttina/message-templates';
import { withEmojis } from '#bot/command-system/responses.js';
import type { CommandContext, CommandReply } from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import { toCommandReply } from './toCommandReply.js';

/**
 * Porta mínima para o roteador de componentes: resolve a ação de um
 * `custom_id` clicado e busca o template referenciado por uma ação.
 * Adaptada, no bootstrap, a partir de `database.templates`.
 */
export interface ComponentActionPort {
  findComponent(
    guildId: string,
    customId: string,
  ): Promise<{ kind: 'button' | 'select_option'; action: ComponentAction } | null>;
  getTemplate(guildId: string, name: string): Promise<{ content: MessageTemplate } | null>;
}

type ComponentInteraction = ButtonInteraction | AnySelectMenuInteraction;

/** Limite de interações de componente em andamento simultaneamente, como `CommandsHandler`. */
const MAX_CONCURRENT = 64;
let inProgress = 0;

const genericFailureMessage = 'Não consegui executar esta ação. Tente de novo daqui a pouco.';

/**
 * Monta o conteúdo comum (sem menções) a partir de um `CommandReply`. Sem tipo
 * de opção do discord.js: `reply`, `update` e `User#send` aceitam `flags`
 * diferentes (só `reply` aceita `Ephemeral`), então cada chamada decide por
 * conta própria — um helper devolvendo `InteractionReplyOptions` não compila
 * em `update`/`send`, que têm um `flags` mais estreito.
 */
function toBasePayload(reply: CommandReply) {
  const base = typeof reply === 'string' ? { content: reply } : reply;
  return { ...base, allowedMentions: { parse: [] } };
}

async function replyEphemeral(interaction: ComponentInteraction, text: string): Promise<void> {
  const options: InteractionReplyOptions = { content: text, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
  if (interaction.deferred || interaction.replied) await interaction.followUp(options);
  else await interaction.reply(options);
}

/**
 * Trata um clique de botão ou escolha de menu criado pelo site: resolve a
 * ação do `custom_id` e aplica `reply`/`edit`/`delete`/`dm`.
 *
 * Menus de seleção (`isAnySelectMenu()`) ainda não são tratados: a tabela
 * `message_components` guarda uma linha por `custom_id`, mas um menu do
 * Discord tem um único `custom_id` para todas as suas opções. Resolver a
 * ação pela opção escolhida (`interaction.values`) exigiria uma consulta que
 * o repositório não oferece hoje; ver desvio reportado no handback desta tarefa.
 */
export async function handleComponentInteraction(
  interaction: ComponentInteraction,
  port: ComponentActionPort,
  emoji: CommandContext['emoji'],
): Promise<void> {
  if (inProgress >= MAX_CONCURRENT) {
    await replyEphemeral(interaction, withEmojis(await emoji('coffee'), 'Já estou ocupada. Tente de novo em instantes.'));
    return;
  }
  inProgress++;
  try {
    await process(interaction, port, emoji);
  } catch (error) {
    log('error', 'component_action_failed', {
      customId: interaction.customId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    try {
      await replyEphemeral(interaction, withEmojis(await emoji('error'), genericFailureMessage));
    } catch {
      log('error', 'component_action_response_failed', { customId: interaction.customId });
    }
  } finally {
    inProgress--;
  }
}

async function process(
  interaction: ComponentInteraction,
  port: ComponentActionPort,
  emoji: CommandContext['emoji'],
): Promise<void> {
  const { customId, guildId } = interaction;
  if (!guildId) {
    await replyEphemeral(interaction, 'Isso só funciona em servidor.');
    return;
  }

  if (interaction.isAnySelectMenu()) {
    // Desvio reportado: resolução por opção de menu ainda não é segura (ver docstring acima).
    await replyEphemeral(interaction, withEmojis(await emoji('ops'), 'Essa opção ainda não está disponível.'));
    return;
  }

  const component = await port.findComponent(guildId, customId);
  if (!component) {
    await replyEphemeral(interaction, withEmojis(await emoji('search'), 'Essa ação não está mais disponível.'));
    return;
  }

  await runButtonAction(interaction, component.action, port, emoji);
}

async function runButtonAction(
  interaction: ButtonInteraction,
  action: ComponentAction,
  port: ComponentActionPort,
  emoji: CommandContext['emoji'],
): Promise<void> {
  if (action.type === 'delete') {
    await runDeleteAction(interaction, emoji);
    return;
  }

  const record = await port.getTemplate(interaction.guildId as string, action.template);
  if (!record) {
    await replyEphemeral(interaction, withEmojis(await emoji('search'), 'O template desta ação não existe mais.'));
    return;
  }
  const reply = toCommandReply(record.content);

  if (action.type === 'reply') {
    const ephemeral = action.ephemeral ?? false;
    await interaction.reply(ephemeral ? { ...toBasePayload(reply), flags: MessageFlags.Ephemeral } : toBasePayload(reply));
    return;
  }
  if (action.type === 'edit') {
    await interaction.update(toBasePayload(reply));
    return;
  }
  // action.type === 'dm'
  try {
    await interaction.user.send(toBasePayload(reply));
    await replyEphemeral(interaction, withEmojis(await emoji('sucess'), 'Pronto. Mandei por DM.'));
  } catch {
    await replyEphemeral(
      interaction,
      withEmojis(await emoji('ops'), 'Não consegui mandar DM. Suas mensagens diretas podem estar fechadas.'),
    );
  }
}

async function runDeleteAction(interaction: ButtonInteraction, emoji: CommandContext['emoji']): Promise<void> {
  await interaction.deferUpdate();
  const canManageMessages = interaction.appPermissions?.has(PermissionsBitField.Flags.ManageMessages, true) ?? false;
  if (!canManageMessages) {
    await interaction.followUp({
      content: withEmojis(await emoji('Angry'), 'Preciso da permissão Gerenciar mensagens neste canal para apagar esta mensagem.'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.message.delete();
  await interaction.followUp({
    content: withEmojis(await emoji('sucess'), 'Pronto. Mensagem apagada.'),
    flags: MessageFlags.Ephemeral,
  });
}
