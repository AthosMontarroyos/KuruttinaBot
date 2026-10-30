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
import { runComponentFunctions } from './componentFunctions.js';

/**
 * Porta mínima para o roteador de componentes: resolve a ação de um
 * `custom_id` clicado e busca o template referenciado por uma ação.
 * Adaptada, no bootstrap, a partir de `database.templates` e `database.customActionsConfig`.
 */
export interface ComponentActionPort {
  findComponent(
    guildId: string,
    customId: string,
  ): Promise<{ kind: 'button' | 'select_option'; action: ComponentAction } | null>;
  getTemplate(guildId: string, name: string): Promise<{ content: MessageTemplate } | null>;
  getButtonConfig(
    guildId: string,
    id: number,
  ): Promise<{ id: number; name: string; functions: { type: string; config: Record<string, unknown> }[] } | null>;
  getSelectConfig(
    guildId: string,
    id: number,
  ): Promise<{
    id: number;
    name: string;
    keepSelection: boolean;
    options: {
      key: string;
      label: string;
      functions: { type: string; config: Record<string, unknown> }[];
    }[];
  } | null>;
}

type ComponentInteraction = ButtonInteraction | AnySelectMenuInteraction;

/** `custom_id` de botão com Component: `kt:c:<id>-<sufixo>` (ver `toCommandReply`). */
const COMPONENT_CUSTOM_ID = /^kt:c:(\d+)-/;

/** `custom_id` de menu com Component: `kt:s:<id>-<sufixo>` (ver `toCommandReply`). */
const SELECT_CUSTOM_ID = /^kt:s:(\d+)-/;

/** Id do Component do servidor carregado no `custom_id`, ou `null` para o formato antigo. */
function componentIdOf(customId: string): number | null {
  const match = COMPONENT_CUSTOM_ID.exec(customId);
  return match ? Number(match[1]) : null;
}

/** Id do Component de menu carregado no `custom_id`, ou `null` quando o menu não tem Component. */
function selectIdOf(customId: string): number | null {
  const match = SELECT_CUSTOM_ID.exec(customId);
  return match ? Number(match[1]) : null;
}

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
 * Trata um clique de botão ou escolha de menu criado pelo site: botão e menu com
 * Component rodam as funções do Component (`kt:c:` e `kt:s:`); o formato antigo de
 * botão (`kt:b:`, linha em `message_components`) segue aplicando `reply`/`edit`/`delete`/`dm`.
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
    const selectId = selectIdOf(customId);
    if (selectId === null) {
      await replyEphemeral(interaction, withEmojis(await emoji('ops'), 'Essa opção ainda não está disponível.'));
      return;
    }
    await runSelect(interaction, guildId, selectId, port, emoji);
    return;
  }

  const componentId = componentIdOf(customId);
  if (componentId !== null) {
    const config = await port.getButtonConfig(guildId, componentId);
    if (!config) {
      await replyEphemeral(interaction, withEmojis(await emoji('search'), 'Essa ação não está mais disponível.'));
      return;
    }
    if (config.functions.length === 0) {
      await interaction.deferUpdate();
      return;
    }
    await runComponentFunctions(interaction, config.functions, { getTemplate: port.getTemplate, emoji });
    return;
  }

  const component = await port.findComponent(guildId, customId);
  if (!component) {
    await replyEphemeral(interaction, withEmojis(await emoji('search'), 'Essa ação não está mais disponível.'));
    return;
  }

  await runButtonAction(interaction, component.action, port, emoji);
}

/** Textos de menu sem Component ou sem opção para a escolha. */
const SELECT_GONE = 'Essa opção não está mais disponível.';

/**
 * Menu do site (`kt:s:<id>-…`): cada valor escolhido carrega a chave da opção antes do `:`.
 * As funções das opções escolhidas rodam na ordem dos valores; valor sem opção é ignorado.
 * Com `keepSelection: false`, o menu volta ao estado sem seleção, salvo se a própria
 * escolha editou ou apagou a mensagem.
 */
async function runSelect(
  interaction: AnySelectMenuInteraction,
  guildId: string,
  selectId: number,
  port: ComponentActionPort,
  emoji: CommandContext['emoji'],
): Promise<void> {
  const config = await port.getSelectConfig(guildId, selectId);
  if (!config) {
    await replyEphemeral(interaction, withEmojis(await emoji('search'), SELECT_GONE));
    return;
  }

  const chosenOptions = [];
  for (const value of interaction.values) {
    const [key = value] = value.split(':');
    const option = config.options.find((item) => item.key === key);
    if (option) chosenOptions.push(option);
  }
  if (chosenOptions.length === 0) {
    await replyEphemeral(interaction, withEmojis(await emoji('ops'), SELECT_GONE));
    return;
  }

  const functions = chosenOptions.flatMap((option) => option.functions);
  await runComponentFunctions(interaction, functions, { getTemplate: port.getTemplate, emoji });

  const changesMessage = functions.some((fn) => fn.type === 'edit_message' || fn.type === 'delete_message');
  if (config.keepSelection === false && !changesMessage) await restoreSelection(interaction);
}

/** Reedita a mensagem com os próprios componentes para limpar a seleção. Falha só vira log. */
async function restoreSelection(interaction: AnySelectMenuInteraction): Promise<void> {
  try {
    await interaction.editReply({ components: interaction.message.components });
  } catch (error) {
    log('error', 'select_restore_failed', {
      customId: interaction.customId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
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
