/**
 * Catálogo de falas do bot.
 *
 * Cada entrada liga uma chave estável a um template, às variáveis que ele
 * aceita e aos emojis que usa. As chaves seguem o formato `<comando>.<situacao>`.
 *
 * `emojis` liga o alias minúsculo usado no template (`{emoji.id}`) ao nome real
 * do emoji (ex.: `ID`), que a infraestrutura resolve para o texto final antes
 * de chamar `fillEmojis`. Ordem de uso: resolver emojis -> fillEmojis -> renderTemplate.
 */

import type { MessageTemplate, TemplateEmbedField, TemplateVariable } from '@kuruttina/message-templates';

export interface MessageCatalogEntry {
  template: MessageTemplate;
  variables: readonly TemplateVariable[];
  /** alias minúsculo -> nome real do emoji. Ex.: `{ id: 'ID' }`. */
  emojis: Readonly<Record<string, string>>;
}

/** Monta o mapa alias -> nome real a partir dos nomes reais dos emojis (alias em minúsculas). */
function emojisOf(...names: string[]): Readonly<Record<string, string>> {
  return Object.fromEntries(names.map((name) => [name.toLowerCase(), name]));
}

/** Fala só de texto, sem embed. */
function plain(
  content: string,
  emojis: Readonly<Record<string, string>>,
  variables: readonly TemplateVariable[] = [],
): MessageCatalogEntry {
  return { template: { content, embeds: [], components: [] }, variables, emojis };
}

/** Nome do Discord (até 32 caracteres, mais as duas crases do code span). */
const nameVariable = (name: string, whenAbsent: string): TemplateVariable => ({
  name,
  maxLength: 34,
  format: 'code',
  whenAbsent,
});
const idVariable = (name: string): TemplateVariable => ({ name, maxLength: 20 });
/** Lista de permissões em português, como `Banir membros, Enviar mensagens`. */
const permissionsVariable: TemplateVariable = { name: 'permissions', maxLength: 120 };
/** Motivo visível: até 200 caracteres limpos (mais as duas crases). */
const reasonVariable: TemplateVariable = { name: 'reason', maxLength: 202, format: 'code', whenAbsent: 'Motivo' };
const lengthVariable: TemplateVariable = { name: 'length', maxLength: 80 };

interface Confirmation {
  content: string;
  emojis: Readonly<Record<string, string>>;
  /** Rótulo do campo do alvo; também é o texto usado quando o nome fica vazio. */
  subject: string;
  /** Ícone do campo do responsável. */
  staff: 'staff' | 'police';
  duration?: boolean;
  /** Sem motivo, o campo é um texto fixo (sem crases); por isso há duas chaves. */
  withReason: boolean;
}

/** Confirmação de moderação: texto com o alvo e embed com alvo, responsável, duração (opcional) e motivo. */
function confirmation(options: Confirmation): MessageCatalogEntry {
  const fields: TemplateEmbedField[] = [
    { name: `{emoji.id} ${options.subject}`, value: '{target}\n`{target.id}`', inline: true },
    { name: `{emoji.${options.staff}} Responsável`, value: '{moderator}\n`{moderator.id}`', inline: true },
  ];
  if (options.duration === true) fields.push({ name: '{emoji.info} Duração', value: '{length}', inline: false });
  fields.push({
    name: '{emoji.note} Motivo',
    value: options.withReason ? '{reason}' : 'Nenhum motivo informado.',
    inline: false,
  });
  return {
    template: { content: options.content, embeds: [{ fields }], components: [] },
    variables: [
      nameVariable('target', options.subject),
      idVariable('target.id'),
      nameVariable('moderator', 'Moderador'),
      idVariable('moderator.id'),
      ...(options.withReason ? [reasonVariable] : []),
      ...(options.duration === true ? [lengthVariable] : []),
    ],
    emojis: options.emojis,
  };
}

const guildOnlyEmojis = emojisOf('ChannelBrowser');
const userDeniedEmojis = emojisOf('Disappointed');
const botDeniedEmojis = emojisOf('Angry');

const reasonTooLong = plain('{emoji.warning} O motivo pode ter no máximo **200** caracteres.', emojisOf('warning'));
const invalidTarget = plain(
  '{emoji.search} Não consegui identificar esse membro. Mencione alguém ou informe um ID válido.',
  emojisOf('search'),
);

const entries = {
  'ping.reply': {
    template: {
      content: '{emoji.dancing} Pong. Ainda estou aqui.',
      embeds: [{
        fields: [
          { name: '{emoji.stats} API', value: '`{api}ms`', inline: true },
          { name: '{emoji.gateway} Gateway', value: '`{gateway}ms`', inline: true },
        ],
      }],
      components: [],
    },
    variables: [{ name: 'api', maxLength: 10 }, { name: 'gateway', maxLength: 10 }],
    emojis: emojisOf('dancing', 'stats', 'gateway'),
  },

  'ban.guild_only': plain('{emoji.channelbrowser} O banimento só pode ser feito em um canal de texto de servidor.', guildOnlyEmojis),
  'ban.missing_permission': plain('{emoji.disappointed} Você precisa da permissão **{permissions}** neste servidor.', userDeniedEmojis, [permissionsVariable]),
  'ban.bot_missing_permission': plain('{emoji.angry} Preciso destas permissões para banir um usuário: **{permissions}**.', botDeniedEmojis, [permissionsVariable]),
  'ban.missing_target': plain('{emoji.question} Diga quem banir. Mencione o membro ou digite o ID!', emojisOf('question')),
  'ban.invalid_target': invalidTarget,
  'ban.reason_too_long': reasonTooLong,
  'ban.failed': plain('{emoji.ops} Não consegui banir esse usuário. Tente de novo daqui a pouco.', emojisOf('ops')),
  'ban.self': plain('{emoji.disappointed} Você não pode se banir... Por que você estaria tentando banir você mesmo?', emojisOf('Disappointed')),
  'ban.bot_target': plain('{emoji.cry} Ei! Por que você está tentando me banir?', emojisOf('cry')),
  'ban.owner': plain('{emoji.disappointed} Não consigo banir o dono deste servidor.', emojisOf('Disappointed')),
  'ban.role_above_actor': plain('{emoji.disappointed} Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode simplesmente bani-lo.', emojisOf('Disappointed')),
  'ban.bot_role_below': plain('{emoji.angry} Ei! Meu cargo está abaixo desse membro ou no mesmo nível. Eu não consigo simplesmente bani-lo desse servidor.', emojisOf('Angry')),
  'ban.already_banned': plain('{emoji.search} Esse usuário já está banido.', emojisOf('search')),
  'ban.user_not_found': plain('{emoji.search} Não encontrei esse usuário.', emojisOf('search')),
  'ban.success': confirmation({
    content: '{emoji.ban} Pronto. {target} foi banido deste servidor. {emoji.coffee}',
    emojis: emojisOf('ban', 'ID', 'staff', 'Note', 'coffee'),
    subject: 'Usuário',
    staff: 'staff',
    withReason: true,
  }),
  'ban.success_no_reason': confirmation({
    content: '{emoji.ban} Pronto. {target} foi banido deste servidor. {emoji.coffee}',
    emojis: emojisOf('ban', 'ID', 'staff', 'Note', 'coffee'),
    subject: 'Usuário',
    staff: 'staff',
    withReason: false,
  }),

  'kick.guild_only': plain('{emoji.channelbrowser} A expulsão só pode ser feita em um canal de texto de servidor.', guildOnlyEmojis),
  'kick.missing_permission': plain('{emoji.disappointed} Você precisa da permissão **{permissions}** neste servidor.', userDeniedEmojis, [permissionsVariable]),
  'kick.bot_missing_permission': plain('{emoji.angry} Preciso destas permissões para expulsar um membro: **{permissions}**.', botDeniedEmojis, [permissionsVariable]),
  'kick.missing_target': plain('{emoji.question} Diga quem expulsar. Mencione o membro ou digite o ID!', emojisOf('question')),
  'kick.invalid_target': invalidTarget,
  'kick.reason_too_long': reasonTooLong,
  'kick.failed': plain('{emoji.ops} Não consegui expulsar esse membro. Tente de novo daqui a pouco.', emojisOf('ops')),
  'kick.self': plain('{emoji.disappointed} Você não pode se expulsar!!', emojisOf('Disappointed')),
  'kick.bot_target': plain('{emoji.angry} Ei! Você não pode me expulsar!!!', emojisOf('Angry')),
  'kick.owner': plain('{emoji.disappointed} Não consigo expulsar o dono deste servidor.', emojisOf('Disappointed')),
  'kick.role_above_actor': plain('{emoji.disappointed} O cargo desse membro está acima do seu ou no mesmo nível. Você não pode expulsá-lo.', emojisOf('Disappointed')),
  'kick.bot_role_below': plain('{emoji.angry} Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo expulsá-lo.', emojisOf('Angry')),
  'kick.member_not_found': plain('{emoji.search} Não encontrei esse membro neste servidor.', emojisOf('search')),
  'kick.success': confirmation({
    content: '{emoji.sucess} Pronto. {target} foi expulso deste servidor. {emoji.kick}',
    emojis: emojisOf('sucess', 'kick', 'ID', 'staff', 'Note'),
    subject: 'Membro',
    staff: 'staff',
    withReason: true,
  }),
  'kick.success_no_reason': confirmation({
    content: '{emoji.sucess} Pronto. {target} foi expulso deste servidor. {emoji.kick}',
    emojis: emojisOf('sucess', 'kick', 'ID', 'staff', 'Note'),
    subject: 'Membro',
    staff: 'staff',
    withReason: false,
  }),

  'timeout.guild_only': plain('{emoji.channelbrowser} O castigo só pode ser feito em um canal de texto de servidor.', guildOnlyEmojis),
  'timeout.missing_permission': plain('{emoji.disappointed} Você precisa da permissão **{permissions}** neste servidor.', userDeniedEmojis, [permissionsVariable]),
  'timeout.bot_missing_permission': plain('{emoji.angry} Preciso destas permissões para castigar um membro: **{permissions}**.', botDeniedEmojis, [permissionsVariable]),
  'timeout.missing_target': plain('{emoji.question} Diga quem castigar. Mencione o membro ou digite o ID!', emojisOf('question')),
  'timeout.missing_duration': plain('{emoji.question} Diga por quanto tempo. Use **10m**, **2h** ou **1d**.', emojisOf('question')),
  'timeout.invalid_target': invalidTarget,
  'timeout.invalid_duration': plain('{emoji.warning} Não entendi essa duração. Use **10m**, **2h**, **1d** ou **1 semana**.', emojisOf('warning')),
  'timeout.duration_too_short': plain('{emoji.warning} O castigo precisa durar pelo menos **1 segundo**.', emojisOf('warning')),
  'timeout.duration_too_long': plain('{emoji.warning} O castigo pode durar no máximo **28 dias**.', emojisOf('warning')),
  'timeout.reason_too_long': reasonTooLong,
  'timeout.failed': plain('{emoji.ops} Não consegui castigar esse membro. Tente de novo daqui a pouco.', emojisOf('ops')),
  'timeout.self': plain('{emoji.disappointed} Você não pode se castigar...', emojisOf('Disappointed')),
  'timeout.bot_target': plain('{emoji.angry} Ei! Você não pode me castigar...', emojisOf('Angry')),
  'timeout.owner': plain('{emoji.disappointed} Não consigo castigar o dono deste servidor.', emojisOf('Disappointed')),
  'timeout.role_above_actor': plain('{emoji.disappointed} Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode castigá-lo!', emojisOf('Disappointed')),
  'timeout.bot_role_below': plain('{emoji.angry} Ei! Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo castigá-lo. {emoji.cry}', emojisOf('Angry', 'cry')),
  'timeout.administrator': plain('{emoji.cry} Não consigo castigar um membro com a permissão **Administrador**.', emojisOf('cry')),
  'timeout.member_not_found': plain('{emoji.search} Não encontrei esse membro neste servidor.', emojisOf('search')),
  'timeout.success': confirmation({
    content: '{emoji.police} {emoji.sucess} Pronto. {target} foi castigado por **{length}**. {emoji.jail}',
    emojis: emojisOf('police', 'sucess', 'jail', 'ID', 'info', 'Note'),
    subject: 'Membro',
    staff: 'police',
    duration: true,
    withReason: true,
  }),
  'timeout.success_no_reason': confirmation({
    content: '{emoji.police} {emoji.sucess} Pronto. {target} foi castigado por **{length}**. {emoji.jail}',
    emojis: emojisOf('police', 'sucess', 'jail', 'ID', 'info', 'Note'),
    subject: 'Membro',
    staff: 'police',
    duration: true,
    withReason: false,
  }),

  'untimeout.guild_only': plain('{emoji.channelbrowser} A remoção do castigo só pode ser feita em um canal de texto de servidor.', guildOnlyEmojis),
  'untimeout.missing_permission': plain('{emoji.disappointed} Você precisa da permissão **{permissions}** neste servidor.', userDeniedEmojis, [permissionsVariable]),
  'untimeout.bot_missing_permission': plain('{emoji.angry} Preciso destas permissões para remover um castigo: **{permissions}**.', botDeniedEmojis, [permissionsVariable]),
  'untimeout.missing_target': plain('{emoji.question} Diga de quem remover o castigo. Mencione o membro ou digite o ID!', emojisOf('question')),
  'untimeout.invalid_target': invalidTarget,
  'untimeout.reason_too_long': reasonTooLong,
  'untimeout.failed': plain('{emoji.ops} Não consegui remover o castigo desse membro. Tente de novo daqui a pouco.', emojisOf('ops')),
  'untimeout.self': plain('{emoji.disappointed} Você não pode remover o próprio castigo.', emojisOf('Disappointed')),
  'untimeout.bot_target': plain('{emoji.angry} Você não pode remover o meu castigo.', emojisOf('Angry')),
  'untimeout.owner': plain('{emoji.disappointed} Ei! Não consigo alterar o castigo do dono deste servidor...', emojisOf('Disappointed')),
  'untimeout.role_above_actor': plain('{emoji.disappointed} Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode remover o castigo dele!', emojisOf('Disappointed')),
  'untimeout.bot_role_below': plain('{emoji.cry} Ei! Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo remover o castigo dele.', emojisOf('cry')),
  'untimeout.administrator': plain('{emoji.cry} Ei! Não consigo alterar o castigo de um membro com a permissão **Administrador**.', emojisOf('cry')),
  'untimeout.not_timed_out': plain('{emoji.search} Esse membro não está castigado.', emojisOf('search')),
  'untimeout.member_not_found': plain('{emoji.search} Não encontrei esse membro neste servidor.', emojisOf('search')),
  'untimeout.success': confirmation({
    content: '{emoji.happy} {emoji.sucess} Pronto. O castigo de {target} foi removido. {emoji.unmute}',
    emojis: emojisOf('happy', 'sucess', 'unmute', 'ID', 'police', 'Note'),
    subject: 'Membro',
    staff: 'police',
    withReason: true,
  }),
  'untimeout.success_no_reason': confirmation({
    content: '{emoji.happy} {emoji.sucess} Pronto. O castigo de {target} foi removido. {emoji.unmute}',
    emojis: emojisOf('happy', 'sucess', 'unmute', 'ID', 'police', 'Note'),
    subject: 'Membro',
    staff: 'police',
    withReason: false,
  }),

  'unban.guild_only': plain('{emoji.channelbrowser} A revogação do banimento só pode ser feita em um canal de texto de servidor.', guildOnlyEmojis),
  'unban.missing_permission': plain('{emoji.disappointed} Você precisa da permissão **{permissions}** neste servidor.', userDeniedEmojis, [permissionsVariable]),
  'unban.bot_missing_permission': plain('{emoji.angry} Preciso destas permissões para revogar um banimento: **{permissions}**.', botDeniedEmojis, [permissionsVariable]),
  'unban.missing_target': plain('{emoji.question} Diga de quem revogar o banimento. Mencione o usuário ou digite o ID!', emojisOf('question')),
  'unban.invalid_target': invalidTarget,
  'unban.reason_too_long': reasonTooLong,
  'unban.failed': plain('{emoji.ops} Não consegui revogar o banimento desse usuário. Tente de novo daqui a pouco.', emojisOf('ops')),
  'unban.self': plain('{emoji.disappointed} Como você estaria tentando revogar o seu próprio banimento?', emojisOf('Disappointed')),
  'unban.bot_target': plain('{emoji.disappointed} Ei! Eu nem estou banida, então como você estaria tentando revogar o meu banimento?', emojisOf('Disappointed')),
  'unban.not_banned': plain('{emoji.search} Ei! Esse usuário não está nem sequer banido.', emojisOf('search')),
  'unban.success': confirmation({
    content: '{emoji.happy} {emoji.sucess} Pronto. O banimento de {target} foi revogado.',
    emojis: emojisOf('happy', 'sucess', 'ID', 'staff', 'Note'),
    subject: 'Usuário',
    staff: 'staff',
    withReason: true,
  }),
  'unban.success_no_reason': confirmation({
    content: '{emoji.happy} {emoji.sucess} Pronto. O banimento de {target} foi revogado.',
    emojis: emojisOf('happy', 'sucess', 'ID', 'staff', 'Note'),
    subject: 'Usuário',
    staff: 'staff',
    withReason: false,
  }),

  // A ficha do emoji: os ícones dos campos, o campo da menção (bloco de código com a marcação),
  // a miniatura e o botão com URL dinâmica ficam no comando, pois o motor não os suporta.
  'emojiinfo.info': {
    template: {
      embeds: [{ color: 0x2b2d31, fields: [{ name: 'Identidade', value: '`{id}`', inline: true }] }],
      components: [],
    },
    variables: [idVariable('id')],
    emojis: {},
  },
  'emojiinfo.usage': plain(
    '{emoji.warning} Envie somente a marcação de um emoji personalizado, como `<:nome:id>` ou `<a:nome:id>`.',
    emojisOf('warning'),
  ),
  'emojiinfo.unavailable': plain('{emoji.ops} Não consegui consultar este emoji agora. Tente de novo daqui a pouco.', emojisOf('ops')),
  'emojiinfo.not_available': plain('{emoji.ops} Não consigo consultar emojis agora. Tente de novo daqui a pouco.', emojisOf('ops')),
} satisfies Record<string, MessageCatalogEntry>;

export const MESSAGE_CATALOG: Readonly<Record<MessageKey, MessageCatalogEntry>> = Object.freeze(entries);

export type MessageKey = keyof typeof entries;
