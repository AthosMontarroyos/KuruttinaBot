import {
  GuildMember,
  MessageFlags,
  type MessageComponentInteraction,
  type Guild,
  type GuildBasedChannel,
  type GuildTextBasedChannel,
  type Role,
} from 'discord.js';
import { ACTION_VARIABLES, renderTemplate, type MessageTemplate } from '@kuruttina/message-templates';
import { isFunctionConfigComplete } from '@kuruttina/message-templates/custom-functions';
import { withEmojis } from '#bot/command-system/responses.js';
import type { CommandContext, CommandReply } from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import { actionValuesFor } from './actionValues.js';
import { toCommandReply } from './toCommandReply.js';

/** Função de um botão: `type` do catálogo e `config` salvo pelo site (validado de novo aqui). */
export interface CustomFunction {
  readonly type: string;
  readonly config: Record<string, unknown>;
}

export interface ComponentFunctionDeps {
  getTemplate: (guildId: string, name: string) => Promise<{ content: MessageTemplate } | null>;
  emoji: CommandContext['emoji'];
}

const GENERIC_FAILURE = 'Não consegui executar esta ação. Tente de novo daqui a pouco.';
const TEMPLATE_GONE = 'O template desta ação não existe mais.';
const CHANNEL_GONE = 'O canal desta ação não existe mais.';
const CHANNEL_NOT_SENDABLE = 'Este canal não aceita mensagens.';
const CHANNEL_NOT_VOICE = 'Este canal não é de voz.';
const NO_PERMISSION_CHANNEL = 'Não tenho permissão para enviar neste canal.';
const NO_PERMISSION_MOVE = 'Não tenho permissão para mover membros.';
const NO_PERMISSION_ROLES = 'Não tenho permissão para gerenciar cargos.';
const NOT_IN_VOICE = 'Entre em um canal de voz primeiro.';
const DM_CLOSED = 'Não consegui mandar DM. Suas mensagens diretas podem estar fechadas.';
const ROLES_SKIPPED = 'Não consegui alterar alguns cargos (estão acima do meu cargo ou são de integração).';
const UNKNOWN_FUNCTION = 'Função desconhecida.';
const INCOMPLETE_FUNCTION = 'Esta ação está incompleta. Revise a configuração no painel.';
const NOT_IN_GUILD = 'Isso só funciona em servidor.';

/** Discord reporta permissão insuficiente com esses códigos de erro de API. */
const MISSING_PERMISSION_API_CODES = new Set([50001, 50013]);

/** Falha esperada de uma função: a mensagem vai para quem clicou; `emojiName` é a chave do emoji. */
class ComponentFunctionError extends Error {
  readonly emojiName: string;

  constructor(emojiName: string, message: string) {
    super(message);
    this.name = 'ComponentFunctionError';
    this.emojiName = emojiName;
  }
}

interface Failure {
  readonly emojiName: string;
  readonly message: string;
  readonly errorName: string;
}

interface RunContext {
  readonly interaction: MessageComponentInteraction;
  readonly guild: Guild;
  readonly deps: ComponentFunctionDeps;
  /** Vira true quando uma função apaga a mensagem do clique: as seguintes que a editam são puladas. */
  messageDeleted: boolean;
}

type Handler = (fn: CustomFunction, ctx: RunContext) => Promise<void>;

/** Mesmo formato de `toBasePayload` do roteador: sem menções e sem `flags` (cada chamada decide). */
function toBasePayload(reply: CommandReply) {
  const base = typeof reply === 'string' ? { content: reply } : reply;
  return { ...base, allowedMentions: { parse: [] } };
}

function errorNameOf(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function isMissingPermission(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'number' &&
    MISSING_PERMISSION_API_CODES.has(error.code)
  );
}

/** Troca erro de permissão do Discord pela mensagem da função; outros erros seguem para o genérico. */
async function guardPermission<T>(action: Promise<T>, message: string): Promise<T> {
  try {
    return await action;
  } catch (error) {
    if (isMissingPermission(error)) throw new ComponentFunctionError('ops', message);
    throw error;
  }
}

/** Canal de servidor com `send`: exclui DM e grupo de DM. Réplica do `deliveryPoller`, que não exporta a checagem. */
function isGuildSendableChannel(channel: GuildBasedChannel): channel is GuildTextBasedChannel {
  return 'guildId' in channel && typeof channel.guildId === 'string' && 'send' in channel;
}

function textField(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string') throw new ComponentFunctionError('ops', INCOMPLETE_FUNCTION);
  return value;
}

function roleIdsField(config: Record<string, unknown>, key: string): string[] {
  const value = config[key];
  if (!Array.isArray(value)) throw new ComponentFunctionError('ops', INCOMPLETE_FUNCTION);
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id !== 'string') throw new ComponentFunctionError('ops', INCOMPLETE_FUNCTION);
    ids.push(id);
  }
  return ids;
}

/** Renderiza o template com as variáveis de ação, como o `deliveryPoller` faz, e devolve o payload sem menções. */
async function renderFor(ctx: RunContext, templateName: string) {
  const record = await ctx.deps.getTemplate(ctx.guild.id, templateName);
  if (!record) throw new ComponentFunctionError('search', TEMPLATE_GONE);
  const values = actionValuesFor(ctx.guild, ctx.interaction.user);
  return toBasePayload(toCommandReply(renderTemplate(record.content, ACTION_VARIABLES, values)));
}

/** Canal do servidor pelo id; ausente, de outro servidor ou sem acesso vira "não existe mais". */
async function fetchTargetChannel(ctx: RunContext, channelId: string): Promise<GuildBasedChannel> {
  let channel: GuildBasedChannel | null;
  try {
    channel = await ctx.guild.channels.fetch(channelId);
  } catch {
    channel = null;
  }
  if (!channel || channel.guildId !== ctx.guild.id) throw new ComponentFunctionError('search', CHANNEL_GONE);
  return channel;
}

/** Membro que clicou: o `interaction.member` quando já é `GuildMember`, senão busca no servidor. */
async function resolveMember(ctx: RunContext): Promise<GuildMember> {
  const member = ctx.interaction.member;
  if (member instanceof GuildMember) return member;
  return ctx.guild.members.fetch(ctx.interaction.user.id);
}

/** Cargo que o bot pode alterar: não é @everyone, não é de integração e está abaixo do cargo do bot. */
function isManageable(role: Role, guild: Guild): boolean {
  return role.id !== guild.id && !role.managed && role.editable;
}

async function fetchRole(guild: Guild, roleId: string): Promise<Role | null> {
  try {
    return await guild.roles.fetch(roleId);
  } catch {
    return null;
  }
}

/** Cargos da lista que o bot pode mexer. Cargo apagado é ignorado em silêncio; `skipped` marca os que o bot não alcança. */
async function resolveRoles(ctx: RunContext, roleIds: readonly string[]): Promise<{ manageable: Role[]; skipped: boolean }> {
  const manageable: Role[] = [];
  let skipped = false;
  for (const id of roleIds) {
    const role = await fetchRole(ctx.guild, id);
    if (!role) continue;
    if (isManageable(role, ctx.guild)) manageable.push(role);
    else skipped = true;
  }
  return { manageable, skipped };
}

/** Chamado depois de aplicar o que era possível: se algum cargo ficou de fora, a função conta como falha. */
function failIfRolesSkipped(fn: CustomFunction, skipped: boolean): void {
  if (!skipped) return;
  log('warn', 'component_function_roles_skipped', { type: fn.type });
  throw new ComponentFunctionError('ops', ROLES_SKIPPED);
}

async function sendMessage(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const payload = await renderFor(ctx, textField(fn.config, 'template'));
  await ctx.interaction.followUp({
    ...payload,
    ...(fn.config.ephemeral === true ? { flags: MessageFlags.Ephemeral } : {}),
  });
}

async function sendChannelMessage(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const channel = await fetchTargetChannel(ctx, textField(fn.config, 'channelId'));
  if (!channel.isTextBased() || !isGuildSendableChannel(channel)) {
    throw new ComponentFunctionError('ops', CHANNEL_NOT_SENDABLE);
  }
  const payload = await renderFor(ctx, textField(fn.config, 'template'));
  await guardPermission(channel.send(payload), NO_PERMISSION_CHANNEL);
}

async function editMessage(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const payload = await renderFor(ctx, textField(fn.config, 'template'));
  await ctx.interaction.editReply(payload);
}

async function deleteMessage(_fn: CustomFunction, ctx: RunContext): Promise<void> {
  await ctx.interaction.message.delete();
  ctx.messageDeleted = true;
}

async function dmUser(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const payload = await renderFor(ctx, textField(fn.config, 'template'));
  try {
    await ctx.interaction.user.send(payload);
  } catch {
    throw new ComponentFunctionError('ops', DM_CLOSED);
  }
}

async function moveInVoice(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const member = await resolveMember(ctx);
  if (!member.voice.channelId) throw new ComponentFunctionError('ops', NOT_IN_VOICE);
  const target = await fetchTargetChannel(ctx, textField(fn.config, 'channelId'));
  if (!target.isVoiceBased()) throw new ComponentFunctionError('ops', CHANNEL_NOT_VOICE);
  await guardPermission(member.voice.setChannel(target), NO_PERMISSION_MOVE);
}

async function addRoles(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const { manageable, skipped } = await resolveRoles(ctx, roleIdsField(fn.config, 'roleIds'));
  const member = await resolveMember(ctx);
  if (manageable.length > 0) await guardPermission(member.roles.add(manageable), NO_PERMISSION_ROLES);
  failIfRolesSkipped(fn, skipped);
}

async function removeRoles(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const { manageable, skipped } = await resolveRoles(ctx, roleIdsField(fn.config, 'roleIds'));
  const member = await resolveMember(ctx);
  if (manageable.length > 0) await guardPermission(member.roles.remove(manageable), NO_PERMISSION_ROLES);
  failIfRolesSkipped(fn, skipped);
}

/** Dá o cargo a quem não tem e tira de quem tem. */
async function toggleRoles(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const { manageable, skipped } = await resolveRoles(ctx, roleIdsField(fn.config, 'roleIds'));
  const member = await resolveMember(ctx);
  const toRemove = manageable.filter((role) => member.roles.cache.has(role.id));
  const toAdd = manageable.filter((role) => !member.roles.cache.has(role.id));
  if (toRemove.length > 0) await guardPermission(member.roles.remove(toRemove), NO_PERMISSION_ROLES);
  if (toAdd.length > 0) await guardPermission(member.roles.add(toAdd), NO_PERMISSION_ROLES);
  failIfRolesSkipped(fn, skipped);
}

/** Deixa o membro com exatamente os cargos da lista que o bot pode gerenciar; os não editáveis ficam como estão. */
async function setRoles(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const { manageable, skipped } = await resolveRoles(ctx, roleIdsField(fn.config, 'roleIds'));
  const member = await resolveMember(ctx);
  const wanted = new Set(manageable.map((role) => role.id));
  const toRemove = [...member.roles.cache.values()].filter((role) => isManageable(role, ctx.guild) && !wanted.has(role.id));
  const toAdd = manageable.filter((role) => !member.roles.cache.has(role.id));
  if (toRemove.length > 0) await guardPermission(member.roles.remove(toRemove), NO_PERMISSION_ROLES);
  if (toAdd.length > 0) await guardPermission(member.roles.add(toAdd), NO_PERMISSION_ROLES);
  failIfRolesSkipped(fn, skipped);
}

const HANDLERS: ReadonlyMap<string, Handler> = new Map<string, Handler>([
  ['send_message', sendMessage],
  ['send_channel_message', sendChannelMessage],
  ['edit_message', editMessage],
  ['delete_message', deleteMessage],
  ['dm_user', dmUser],
  ['move_users_in_voice', moveInVoice],
  ['add_roles', addRoles],
  ['remove_roles', removeRoles],
  ['toggle_roles', toggleRoles],
  ['set_roles', setRoles],
]);

async function runOne(fn: CustomFunction, ctx: RunContext): Promise<void> {
  const handler = HANDLERS.get(fn.type);
  if (!handler) throw new ComponentFunctionError('ops', UNKNOWN_FUNCTION);
  if (!isFunctionConfigComplete(fn)) throw new ComponentFunctionError('ops', INCOMPLETE_FUNCTION);
  await handler(fn, ctx);
}

function toFailure(error: unknown): Failure {
  if (error instanceof ComponentFunctionError) {
    return { emojiName: error.emojiName, message: error.message, errorName: error.name };
  }
  return { emojiName: 'error', message: GENERIC_FAILURE, errorName: errorNameOf(error) };
}

/** Um único followUp efêmero com a primeira falha. Nunca lança: falha ao responder só vira log. */
async function notifyFailure(interaction: MessageComponentInteraction, deps: ComponentFunctionDeps, failure: Failure): Promise<void> {
  try {
    await interaction.followUp({
      content: withEmojis(await deps.emoji(failure.emojiName), failure.message),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    log('error', 'component_function_response_failed', { errorName: errorNameOf(error) });
  }
}

/**
 * Executa, em ordem, as funções configuradas em um botão ou menu do site. Confirma o clique
 * (deferUpdate) antes de tudo; cada função tem seu próprio try/catch, então a falha de
 * uma não impede as seguintes. Se alguma falhou, manda um único followUp efêmero com a
 * primeira falha. Sucesso fica silencioso.
 */
export async function runComponentFunctions(
  interaction: MessageComponentInteraction,
  functions: readonly CustomFunction[],
  deps: ComponentFunctionDeps,
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferUpdate();
    } catch (error) {
      log('error', 'component_function_defer_failed', { errorName: errorNameOf(error) });
      return;
    }
  }

  const guild = interaction.guild;
  if (!guild) {
    await notifyFailure(interaction, deps, { emojiName: 'ops', message: NOT_IN_GUILD, errorName: 'NotInGuild' });
    return;
  }

  const ctx: RunContext = { interaction, guild, deps, messageDeleted: false };
  let firstFailure: Failure | null = null;
  for (const fn of functions) {
    // Sem mensagem para editar depois que a própria função a apagou.
    if (fn.type === 'edit_message' && ctx.messageDeleted) continue;
    try {
      await runOne(fn, ctx);
    } catch (error) {
      const failure = toFailure(error);
      firstFailure ??= failure;
      log('error', 'component_function_failed', { type: fn.type, errorName: failure.errorName });
    }
  }

  if (firstFailure) await notifyFailure(interaction, deps, firstFailure);
}
