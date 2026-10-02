import { PermissionFlagsBits, type Guild } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { command as timeoutCommand, formatTimeoutDuration, parseTimeoutPrefixArgs } from '../apps/bot/src/commands/mod/timeout.js';
import { command as untimeoutCommand, parseUntimeoutPrefixArgs } from '../apps/bot/src/commands/mod/untimeout.js';
import type { CommandContext, CommandReply, GuildMemberProfile, MemberModerationPort } from '../apps/bot/src/command-system/types.js';
import { createEmojiResolver } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import { createMemberModerationAdapter } from '../apps/bot/src/infrastructure/discord/moderation/memberModerationAdapter.js';

const ACTOR = '111111111111111111';
const TARGET = '222222222222222222';
const BOT = '333333333333333333';
const OWNER = '444444444444444444';
const TEN_MINUTES = 10 * 60 * 1000;

function profile(
  id: string,
  name: string,
  position: number,
  extras: Partial<Pick<GuildMemberProfile, 'administrator' | 'timedOutUntil'>> = {},
): GuildMemberProfile {
  return {
    id,
    displayName: name,
    highestRolePosition: position,
    administrator: false,
    timedOutUntil: null,
    ...extras,
  };
}

function moderation(options: {
  members?: Record<string, GuildMemberProfile | null>;
  timeout?: MemberModerationPort['timeout'];
  clearTimeout?: MemberModerationPort['clearTimeout'];
  ownerId?: string;
  botUserId?: string | null;
} = {}): MemberModerationPort {
  const members: Record<string, GuildMemberProfile | null> = {
    [ACTOR]: profile(ACTOR, 'Mod', 5),
    [TARGET]: profile(TARGET, 'Alvo', 2),
    [BOT]: profile(BOT, 'Kuruttina', 10),
    [OWNER]: profile(OWNER, 'Dono', 20),
    ...options.members,
  };
  return {
    ownerId: options.ownerId ?? OWNER,
    botUserId: options.botUserId === undefined ? BOT : options.botUserId,
    fetchMember: async (userId: string) => members[userId] ?? null,
    kick: vi.fn(async () => 'kicked' as const),
    timeout: options.timeout ?? vi.fn(async () => 'timed-out' as const),
    clearTimeout: options.clearTimeout ?? vi.fn(async () => 'cleared' as const),
  };
}

function context(overrides: Partial<CommandContext> = {}): CommandContext {
  const allowed = { has: () => true };
  return {
    userId: ACTOR,
    guildId: 'guild-id',
    apiPing: 1,
    gatewayPing: 1,
    acknowledge: vi.fn(async () => undefined),
    emoji: vi.fn(async (name: string) => `<:${name}:${name}-id>`),
    reply: vi.fn(async () => undefined),
    sendMessage: vi.fn(async () => undefined),
    deleteReply: vi.fn(async () => undefined),
    memberPermissions: allowed,
    appPermissions: allowed,
    textChannel: {
      isThread: false,
      fetchMessages: async () => [],
      bulkDelete: async () => 0,
      deleteMessage: async () => false,
    },
    memberModeration: moderation(),
    rawArgs: `<@${TARGET}> 10m motivo claro`,
    ...overrides,
  };
}

function replyText(reply: CommandContext['reply']): string {
  const value: unknown = (reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
  return typeof value === 'string' ? value : '';
}

function sentMessage(ctx: CommandContext): CommandReply {
  const sendMessage = ctx.sendMessage as ReturnType<typeof vi.fn>;
  return sendMessage.mock.calls[0]?.[0] as CommandReply;
}

describe('timeout duration', () => {
  it('parses compact, spaced and Portuguese durations', () => {
    expect(parseTimeoutPrefixArgs(`<@${TARGET}> 10m quebrou a regra`)).toEqual({
      ok: true,
      userId: TARGET,
      durationMs: TEN_MINUTES,
      reason: 'quebrou a regra',
    });
    expect(parseTimeoutPrefixArgs(`<@!${TARGET}> 1h30m`)).toEqual({
      ok: true,
      userId: TARGET,
      durationMs: 90 * 60 * 1000,
    });
    expect(parseTimeoutPrefixArgs(`${TARGET} 1 hora e 30 minutos aviso`)).toEqual({
      ok: true,
      userId: TARGET,
      durationMs: 90 * 60 * 1000,
      reason: 'aviso',
    });
    expect(parseTimeoutPrefixArgs(`${TARGET} 1d2h`)).toMatchObject({ ok: true, durationMs: 26 * 60 * 60 * 1000 });
    expect(parseTimeoutPrefixArgs(`${TARGET} 28d`)).toMatchObject({ ok: true, durationMs: 28 * 24 * 60 * 60 * 1000 });
    expect(parseTimeoutPrefixArgs(`${TARGET} 4w`)).toMatchObject({ ok: true, durationMs: 28 * 24 * 60 * 60 * 1000 });
    expect(parseTimeoutPrefixArgs(`${TARGET} 1 semana, 2 dias`)).toMatchObject({
      ok: true,
      durationMs: 9 * 24 * 60 * 60 * 1000,
    });
  });

  it('rejects a missing member, a missing duration, junk and the Discord limit', () => {
    expect(parseTimeoutPrefixArgs('   ')).toEqual({ ok: false, reason: 'missing' });
    expect(parseTimeoutPrefixArgs(TARGET)).toEqual({ ok: false, reason: 'missing-duration' });
    expect(parseTimeoutPrefixArgs('alguem 10m')).toEqual({ ok: false, reason: 'invalid-user' });
    expect(parseTimeoutPrefixArgs(`${TARGET} 10motivo`)).toEqual({ ok: false, reason: 'invalid-duration' });
    expect(parseTimeoutPrefixArgs(`${TARGET} 1h30`)).toEqual({ ok: false, reason: 'invalid-duration' });
    expect(parseTimeoutPrefixArgs(`${TARGET} 0s`)).toEqual({ ok: false, reason: 'duration-too-short' });
    expect(parseTimeoutPrefixArgs(`${TARGET} 28d1s`)).toEqual({ ok: false, reason: 'duration-too-long' });
    expect(parseTimeoutPrefixArgs(`${TARGET} 10m ${'a'.repeat(201)}`)).toEqual({ ok: false, reason: 'reason-too-long' });
  });

  it('formats the duration in Portuguese from the largest unit', () => {
    expect(formatTimeoutDuration(TEN_MINUTES)).toBe('10 minutos');
    expect(formatTimeoutDuration(90 * 60 * 1000)).toBe('1 hora e 30 minutos');
    expect(formatTimeoutDuration(26 * 60 * 60 * 1000)).toBe('1 dia e 2 horas');
    expect(formatTimeoutDuration(28 * 24 * 60 * 60 * 1000)).toBe('4 semanas');
  });
});

describe('timeout command', () => {
  it('publishes timeout with the Castigar membros permission', () => {
    const json = timeoutCommand.data.toJSON();
    expect(json.name).toBe('timeout');
    expect(json.description).toBe('Aplica um castigo temporário a um membro');
    expect(json.default_member_permissions).toBe(String(PermissionFlagsBits.ModerateMembers));
    expect(json.options?.map((option) => option.name)).toEqual(['membro', 'duracao', 'motivo']);
  });

  it('times the member out and publishes the confirmation embed', async () => {
    const guild = moderation();
    const ctx = context({ memberModeration: guild });
    await timeoutCommand.execute(ctx);

    expect(guild.timeout).toHaveBeenCalledWith(TARGET, TEN_MINUTES, `Moderador ${ACTOR} por 10 minutos: motivo claro`);
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '<:sucess:sucess-id> Pronto. `Alvo` foi castigado por **10 minutos**. <:mute:mute-id>',
      embeds: [{
        color: 0x2b2d31,
        fields: [
          { name: '<:ID:ID-id> Membro', value: '`Alvo`\n`222222222222222222`', inline: true },
          { name: '<:staff:staff-id> Responsável', value: '`Mod`\n`111111111111111111`', inline: true },
          { name: '<:info:info-id> Duração', value: '10 minutos', inline: false },
          { name: '<:Note:Note-id> Motivo', value: '`motivo claro`', inline: false },
        ],
      }],
    });
    expect(ctx.deleteReply).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('keeps the confirmation readable when custom emojis are unavailable', async () => {
    const ctx = context({
      rawArgs: `<@${TARGET}> 90m`,
      emoji: createEmojiResolver({ emojis: { fetch: vi.fn().mockRejectedValue(new Error('Unavailable')) } }),
    });
    await timeoutCommand.execute(ctx);
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '✅ Pronto. `Alvo` foi castigado por **1 hora e 30 minutos**.',
      embeds: [{
        fields: [
          { name: '🪪 Membro', value: '`Alvo`\n`222222222222222222`' },
          { name: 'Responsável' },
          { name: 'Duração', value: '1 hora e 30 minutos' },
          { name: 'Motivo', value: 'Nenhum motivo informado.' },
        ],
      }],
    });
  });

  it('reads the slash member, duration and an optional reason', async () => {
    const guild = moderation();
    const ctx = context({
      rawArgs: undefined,
      options: [
        { name: 'membro', value: TARGET },
        { name: 'duracao', value: ' 2h ' },
        { name: 'motivo', value: '  aviso  ' },
      ],
      memberModeration: guild,
    });
    await timeoutCommand.execute(ctx);
    expect(guild.timeout).toHaveBeenCalledWith(TARGET, 2 * 60 * 60 * 1000, `Moderador ${ACTOR} por 2 horas: aviso`);
  });

  it('rejects a duration that hides the reason in the slash field', async () => {
    const guild = moderation();
    const ctx = context({
      rawArgs: undefined,
      options: [{ name: 'membro', value: TARGET }, { name: 'duracao', value: '10m motivo' }],
      memberModeration: guild,
    });
    await timeoutCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:warning:warning-id> Não entendi essa duração. Use **10m**, **2h**, **1d** ou **1 semana**.');
    expect(guild.timeout).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'question', 'Diga quem castigar. Mencione o membro ou digite o ID!'],
    [TARGET, 'question', 'Diga por quanto tempo. Use **10m**, **2h** ou **1d**.'],
    ['pessoa 10m', 'search', 'Não consegui identificar esse membro. Mencione alguém ou informe um ID válido.'],
    [`${TARGET} depois`, 'warning', 'Não entendi essa duração. Use **10m**, **2h**, **1d** ou **1 semana**.'],
    [`${TARGET} 0m`, 'warning', 'O castigo precisa durar pelo menos **1 segundo**.'],
    [`${TARGET} 29d`, 'warning', 'O castigo pode durar no máximo **28 dias**.'],
    [`${TARGET} 10m ${'x'.repeat(201)}`, 'warning', 'O motivo pode ter no máximo **200** caracteres.'],
  ])('rejects prefix input %j before any timeout', async (rawArgs, emoji, text) => {
    const guild = moderation();
    const ctx = context({ rawArgs, memberModeration: guild });
    await timeoutCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe(`<:${emoji}:${emoji}-id> ${text}`);
    expect(guild.timeout).not.toHaveBeenCalled();
  });

  it('refuses the author, the bot, the owner, a higher role and an administrator', async () => {
    const cases: Array<{ rawArgs: string; members?: Record<string, GuildMemberProfile>; text: string }> = [
      { rawArgs: `<@${ACTOR}> 10m`, text: '<:Disappointed:Disappointed-id> Você não pode se castigar.' },
      { rawArgs: `<@${BOT}> 10m`, text: '<:Angry:Angry-id> Você não pode me castigar.' },
      { rawArgs: `<@${OWNER}> 10m`, text: '<:Disappointed:Disappointed-id> Não consigo castigar o dono deste servidor.' },
      {
        rawArgs: `<@${TARGET}> 10m`,
        members: { [TARGET]: profile(TARGET, 'Alvo', 5) },
        text: '<:Disappointed:Disappointed-id> O cargo desse membro está acima do seu ou no mesmo nível. Você não pode castigá-lo.',
      },
      {
        rawArgs: `<@${TARGET}> 10m`,
        members: { [BOT]: profile(BOT, 'Kuruttina', 2) },
        text: '<:Angry:Angry-id> Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo castigá-lo.',
      },
      {
        rawArgs: `<@${TARGET}> 10m`,
        members: { [TARGET]: profile(TARGET, 'Alvo', 2, { administrator: true }) },
        text: '<:Disappointed:Disappointed-id> Não consigo castigar um membro com a permissão **Administrador**.',
      },
    ];
    for (const entry of cases) {
      const guild = moderation({ ...(entry.members ? { members: entry.members } : {}) });
      const ctx = context({ rawArgs: entry.rawArgs, memberModeration: guild });
      await timeoutCommand.execute(ctx);
      expect(replyText(ctx.reply)).toBe(entry.text);
      expect(guild.timeout).not.toHaveBeenCalled();
    }
  });

  it('lets the server owner time out a member above their highest role', async () => {
    const guild = moderation({
      ownerId: ACTOR,
      members: {
        [ACTOR]: profile(ACTOR, 'Dono', 1),
        [TARGET]: profile(TARGET, 'Alvo', 50),
        [BOT]: profile(BOT, 'Kuruttina', 60),
      },
    });
    const ctx = context({ memberModeration: guild, rawArgs: `${TARGET} 1h` });
    await timeoutCommand.execute(ctx);
    expect(guild.timeout).toHaveBeenCalledOnce();
  });

  it('replaces a timeout that is already active', async () => {
    const guild = moderation({
      members: { [TARGET]: profile(TARGET, 'Alvo', 2, { timedOutUntil: Date.now() + 60_000 }) },
    });
    const ctx = context({ memberModeration: guild, rawArgs: `${TARGET} 1d` });
    await timeoutCommand.execute(ctx);
    expect(guild.timeout).toHaveBeenCalledWith(TARGET, 24 * 60 * 60 * 1000, `Moderador ${ACTOR} por 1 dia`);
  });

  it('reports a member who is not in the server', async () => {
    const guild = moderation({ members: { [TARGET]: null } });
    const ctx = context({ memberModeration: guild });
    await timeoutCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:search:search-id> Não encontrei esse membro neste servidor.');
    expect(guild.timeout).not.toHaveBeenCalled();
  });

  it('reports a member who leaves before the timeout completes', async () => {
    const guild = moderation({ timeout: vi.fn(async () => 'missing' as const) });
    const ctx = context({ memberModeration: guild });
    await timeoutCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:search:search-id> Não encontrei esse membro neste servidor.');
    expect(ctx.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps the failure calm when Discord rejects the timeout', async () => {
    const guild = moderation({
      timeout: vi.fn(async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); }),
    });
    const ctx = context({ memberModeration: guild });
    await timeoutCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:ops:ops-id> Não consegui castigar esse membro. Tente de novo daqui a pouco.');
    expect(replyText(ctx.reply)).not.toContain('50013');
  });

  it('denies the command when the author lacks Moderate Members', async () => {
    const guild = moderation();
    const ctx = context({
      memberModeration: guild,
      memberPermissions: { has: (permission) => permission !== PermissionFlagsBits.ModerateMembers },
    });
    await timeoutCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:Disappointed:Disappointed-id> Você precisa da permissão **Castigar membros** neste servidor.');
    expect(guild.timeout).not.toHaveBeenCalled();
  });

  it('strips backticks from the visible name and reason', async () => {
    const guild = moderation({
      members: {
        [TARGET]: profile(TARGET, 'Al`vo', 1),
        [ACTOR]: profile(ACTOR, 'M`od', 5),
      },
    });
    const ctx = context({ memberModeration: guild, rawArgs: `<@${TARGET}> 10m moti\`vo` });
    await timeoutCommand.execute(ctx);
    const message = sentMessage(ctx) as Exclude<CommandReply, string>;
    expect(message.content).toContain('`Alvo`');
    expect(message.embeds[0]?.fields?.[3]?.value).toBe('`motivo`');
    expect(message.content).not.toContain('`vo`');
  });
});

describe('untimeout command', () => {
  it('parses a mention and a reason, and rejects bad input', () => {
    expect(parseUntimeoutPrefixArgs(`<@${TARGET}> acabou`)).toEqual({ ok: true, userId: TARGET, reason: 'acabou' });
    expect(parseUntimeoutPrefixArgs(TARGET)).toEqual({ ok: true, userId: TARGET });
    expect(parseUntimeoutPrefixArgs('   ')).toEqual({ ok: false, reason: 'missing' });
    expect(parseUntimeoutPrefixArgs('alguem')).toEqual({ ok: false, reason: 'invalid-user' });
    expect(parseUntimeoutPrefixArgs(`${TARGET} ${'a'.repeat(201)}`)).toEqual({ ok: false, reason: 'reason-too-long' });
  });

  it('publishes untimeout with the Castigar membros permission', () => {
    const json = untimeoutCommand.data.toJSON();
    expect(json.name).toBe('untimeout');
    expect(json.description).toBe('Remove o castigo de um membro');
    expect(json.default_member_permissions).toBe(String(PermissionFlagsBits.ModerateMembers));
    expect(json.options?.map((option) => option.name)).toEqual(['membro', 'motivo']);
  });

  it('removes an active timeout and publishes the confirmation', async () => {
    const guild = moderation({
      members: { [TARGET]: profile(TARGET, 'Alvo', 2, { timedOutUntil: Date.now() + 60_000 }) },
    });
    const ctx = context({ memberModeration: guild, rawArgs: `<@${TARGET}> motivo claro` });
    await untimeoutCommand.execute(ctx);

    expect(guild.clearTimeout).toHaveBeenCalledWith(TARGET, `Moderador ${ACTOR}: motivo claro`);
    expect(guild.timeout).not.toHaveBeenCalled();
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '<:sucess:sucess-id> Pronto. O castigo de `Alvo` foi removido. <:unmute:unmute-id>',
      embeds: [{
        color: 0x2b2d31,
        fields: [
          { name: '<:ID:ID-id> Membro', value: '`Alvo`\n`222222222222222222`', inline: true },
          { name: '<:staff:staff-id> Responsável', value: '`Mod`\n`111111111111111111`', inline: true },
          { name: '<:Note:Note-id> Motivo', value: '`motivo claro`', inline: false },
        ],
      }],
    });
    expect(ctx.deleteReply).toHaveBeenCalledOnce();
  });

  it('keeps the removal readable when custom emojis are unavailable', async () => {
    const ctx = context({
      rawArgs: `<@${TARGET}>`,
      memberModeration: moderation({
        members: { [TARGET]: profile(TARGET, 'Alvo', 2, { timedOutUntil: Date.now() + 60_000 }) },
      }),
      emoji: createEmojiResolver({ emojis: { fetch: vi.fn().mockRejectedValue(new Error('Unavailable')) } }),
    });
    await untimeoutCommand.execute(ctx);
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '✅ Pronto. O castigo de `Alvo` foi removido.',
      embeds: [{
        fields: [
          { name: '🪪 Membro' },
          { name: 'Responsável' },
          { name: 'Motivo', value: 'Nenhum motivo informado.' },
        ],
      }],
    });
  });

  it('does nothing when the member is not timed out', async () => {
    const guild = moderation();
    const ctx = context({ memberModeration: guild, rawArgs: `<@${TARGET}>` });
    await untimeoutCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:search:search-id> Esse membro não está castigado.');
    expect(guild.clearTimeout).not.toHaveBeenCalled();
  });

  it('refuses to clear the author, the bot, the owner, a higher role or an administrator', async () => {
    const active = { timedOutUntil: Date.now() + 60_000 };
    const cases: Array<{ rawArgs: string; members?: Record<string, GuildMemberProfile>; text: string }> = [
      { rawArgs: `<@${ACTOR}>`, text: '<:Disappointed:Disappointed-id> Você não pode remover o próprio castigo.' },
      { rawArgs: `<@${BOT}>`, text: '<:Angry:Angry-id> Você não pode remover o meu castigo.' },
      {
        rawArgs: `<@${OWNER}>`,
        members: { [OWNER]: profile(OWNER, 'Dono', 20, active) },
        text: '<:Disappointed:Disappointed-id> Não consigo alterar o castigo do dono deste servidor.',
      },
      {
        rawArgs: `<@${TARGET}>`,
        members: { [TARGET]: profile(TARGET, 'Alvo', 5, active) },
        text: '<:Disappointed:Disappointed-id> O cargo desse membro está acima do seu ou no mesmo nível. Você não pode remover o castigo dele.',
      },
      {
        rawArgs: `<@${TARGET}>`,
        members: {
          [TARGET]: profile(TARGET, 'Alvo', 2, active),
          [BOT]: profile(BOT, 'Kuruttina', 2),
        },
        text: '<:Angry:Angry-id> Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo remover o castigo dele.',
      },
      {
        rawArgs: `<@${TARGET}>`,
        members: { [TARGET]: profile(TARGET, 'Alvo', 2, { ...active, administrator: true }) },
        text: '<:Disappointed:Disappointed-id> Não consigo alterar o castigo de um membro com a permissão **Administrador**.',
      },
    ];
    for (const entry of cases) {
      const guild = moderation({ ...(entry.members ? { members: entry.members } : {}) });
      const ctx = context({ rawArgs: entry.rawArgs, memberModeration: guild });
      await untimeoutCommand.execute(ctx);
      expect(replyText(ctx.reply)).toBe(entry.text);
      expect(guild.clearTimeout).not.toHaveBeenCalled();
    }
  });

  it('keeps the failure calm when Discord rejects the removal', async () => {
    const guild = moderation({
      members: { [TARGET]: profile(TARGET, 'Alvo', 2, { timedOutUntil: Date.now() + 60_000 }) },
      clearTimeout: vi.fn(async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); }),
    });
    const ctx = context({ memberModeration: guild, rawArgs: TARGET });
    await untimeoutCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:ops:ops-id> Não consegui remover o castigo desse membro. Tente de novo daqui a pouco.');
    expect(replyText(ctx.reply)).not.toContain('50013');
  });
});

describe('member timeout adapter', () => {
  function member(userId: string, timeout: ReturnType<typeof vi.fn>, until: number | null, administrator: boolean) {
    return {
      id: userId,
      displayName: 'Presente',
      roles: { highest: { position: 3 } },
      permissions: { has: (bit: bigint) => administrator && bit === PermissionFlagsBits.Administrator },
      communicationDisabledUntilTimestamp: until,
      timeout,
    };
  }

  it('applies and clears a timeout, and treats an unknown member as missing', async () => {
    const timeout = vi.fn(async () => undefined);
    const future = Date.now() + 60_000;
    const guild = {
      ownerId: OWNER,
      members: {
        me: { id: BOT },
        fetch: vi.fn(async (userId: string) => {
          if (userId === TARGET) throw Object.assign(new Error('Unknown Member'), { code: 10007 });
          return member(userId, timeout, future, true);
        }),
      },
    };
    const port = createMemberModerationAdapter(guild as unknown as Guild);
    expect(await port.fetchMember(ACTOR)).toMatchObject({ administrator: true, timedOutUntil: future });
    expect(await port.timeout(TARGET, TEN_MINUTES, 'Moderador')).toBe('missing');
    expect(await port.timeout(ACTOR, TEN_MINUTES, 'Moderador')).toBe('timed-out');
    expect(timeout).toHaveBeenCalledWith(TEN_MINUTES, 'Moderador');
    expect(await port.clearTimeout(ACTOR, 'Moderador')).toBe('cleared');
    expect(timeout).toHaveBeenLastCalledWith(null, 'Moderador');
  });

  it('treats an expired timeout as absent', async () => {
    const guild = {
      ownerId: OWNER,
      members: {
        me: { id: BOT },
        fetch: vi.fn(async (userId: string) => member(userId, vi.fn(), Date.now() - 1_000, false)),
      },
    };
    const port = createMemberModerationAdapter(guild as unknown as Guild);
    expect(await port.fetchMember(ACTOR)).toMatchObject({ administrator: false, timedOutUntil: null });
  });
});
