import { PermissionFlagsBits, type Guild } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { command as banCommand, parseBanPrefixArgs } from '../apps/bot/src/commands/mod/ban.js';
import { command as unbanCommand, parseUnbanPrefixArgs } from '../apps/bot/src/commands/mod/unban.js';
import type {
  CommandContext,
  CommandReply,
  GuildMemberProfile,
  MemberModerationPort,
  ModeratedUserProfile,
} from '../apps/bot/src/command-system/types.js';
import { createEmojiResolver } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import { createMemberModerationAdapter } from '../apps/bot/src/infrastructure/discord/moderation/memberModerationAdapter.js';

const ACTOR = '111111111111111111';
const TARGET = '222222222222222222';
const BOT = '333333333333333333';
const OWNER = '444444444444444444';

function profile(id: string, name: string, position: number): GuildMemberProfile {
  return { id, displayName: name, highestRolePosition: position, administrator: false, timedOutUntil: null };
}

function user(id: string, name: string): ModeratedUserProfile {
  return { id, displayName: name };
}

function moderation(options: {
  members?: Record<string, GuildMemberProfile | null>;
  ban?: MemberModerationPort['ban'];
  unban?: MemberModerationPort['unban'];
  fetchUser?: MemberModerationPort['fetchUser'];
  fetchBan?: MemberModerationPort['fetchBan'];
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
    timeout: vi.fn(async () => 'timed-out' as const),
    clearTimeout: vi.fn(async () => 'cleared' as const),
    fetchUser: options.fetchUser ?? vi.fn(async () => null),
    fetchBan: options.fetchBan ?? vi.fn(async () => null),
    ban: options.ban ?? vi.fn(async () => 'banned' as const),
    unban: options.unban ?? vi.fn(async () => 'unbanned' as const),
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
    rawArgs: `<@${TARGET}> motivo claro`,
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

describe('ban command', () => {
  it('parses a mention, a snowflake and a spaced reason', () => {
    expect(parseBanPrefixArgs(`<@${TARGET}> quebrou a regra`)).toEqual({
      ok: true,
      userId: TARGET,
      reason: 'quebrou a regra',
    });
    expect(parseBanPrefixArgs(`<@!${TARGET}>`)).toEqual({ ok: true, userId: TARGET });
    expect(parseBanPrefixArgs(TARGET)).toEqual({ ok: true, userId: TARGET });
  });

  it('rejects an empty call, an invalid member and a long reason', () => {
    expect(parseBanPrefixArgs('   ')).toEqual({ ok: false, reason: 'missing' });
    expect(parseBanPrefixArgs('alguem')).toEqual({ ok: false, reason: 'invalid-user' });
    expect(parseBanPrefixArgs(`${TARGET} ${'a'.repeat(201)}`)).toEqual({ ok: false, reason: 'reason-too-long' });
  });

  it('publishes ban with the Banir membros permission', () => {
    const json = banCommand.data.toJSON();
    expect(json.name).toBe('ban');
    expect(json.description).toBe('Bane um usuário do servidor');
    expect(json.default_member_permissions).toBe(String(PermissionFlagsBits.BanMembers));
    expect(json.options?.map((option) => option.name)).toEqual(['membro', 'motivo']);
  });

  it('bans a member and publishes the confirmation embed', async () => {
    const guild = moderation();
    const ctx = context({ memberModeration: guild });
    await banCommand.execute(ctx);

    expect(guild.ban).toHaveBeenCalledWith(TARGET, `Moderador ${ACTOR}: motivo claro`);
    expect(guild.fetchBan).not.toHaveBeenCalled();
    expect(guild.fetchUser).not.toHaveBeenCalled();
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '<:ban:ban-id> Pronto. `Alvo` foi banido deste servidor. <:coffee:coffee-id>',
      embeds: [{
        color: 0x2b2d31,
        fields: [
          { name: '<:ID:ID-id> Usuário', value: '`Alvo`\n`222222222222222222`', inline: true },
          { name: '<:staff:staff-id> Responsável', value: '`Mod`\n`111111111111111111`', inline: true },
          { name: '<:Note:Note-id> Motivo', value: '`motivo claro`', inline: false },
        ],
      }],
    });
    expect(ctx.deleteReply).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('keeps the confirmation readable when custom emojis are unavailable', async () => {
    const ctx = context({
      rawArgs: `<@${TARGET}>`,
      emoji: createEmojiResolver({ emojis: { fetch: vi.fn().mockRejectedValue(new Error('Unavailable')) } }),
    });
    await banCommand.execute(ctx);
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: 'Pronto. `Alvo` foi banido deste servidor. ☕',
      embeds: [{
        fields: [
          { name: '🪪 Usuário', value: '`Alvo`\n`222222222222222222`' },
          { name: 'Responsável' },
          { name: 'Motivo', value: 'Nenhum motivo informado.' },
        ],
      }],
    });
  });

  it('reads the slash member and an optional reason', async () => {
    const guild = moderation();
    const ctx = context({
      rawArgs: undefined,
      options: [{ name: 'membro', value: TARGET }, { name: 'motivo', value: '  aviso  ' }],
      memberModeration: guild,
    });
    await banCommand.execute(ctx);
    expect(guild.ban).toHaveBeenCalledWith(TARGET, `Moderador ${ACTOR}: aviso`);
  });

  it('bans an account that is not in the server', async () => {
    const guild = moderation({
      members: { [TARGET]: null },
      fetchUser: vi.fn(async () => user(TARGET, 'Fora')),
    });
    const ctx = context({ memberModeration: guild, rawArgs: TARGET });
    await banCommand.execute(ctx);

    expect(guild.fetchBan).toHaveBeenCalledWith(TARGET);
    expect(guild.ban).toHaveBeenCalledWith(TARGET, `Moderador ${ACTOR}`);
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '<:ban:ban-id> Pronto. `Fora` foi banido deste servidor. <:coffee:coffee-id>',
    });
  });

  it('refuses an account that is already banned or does not exist', async () => {
    const banned = moderation({
      members: { [TARGET]: null },
      fetchBan: vi.fn(async () => user(TARGET, 'Fora')),
    });
    const bannedCtx = context({ memberModeration: banned, rawArgs: TARGET });
    await banCommand.execute(bannedCtx);
    expect(replyText(bannedCtx.reply)).toBe('<:search:search-id> Esse usuário já está banido.');
    expect(banned.ban).not.toHaveBeenCalled();
    expect(banned.fetchUser).not.toHaveBeenCalled();

    const unknown = moderation({ members: { [TARGET]: null } });
    const unknownCtx = context({ memberModeration: unknown, rawArgs: TARGET });
    await banCommand.execute(unknownCtx);
    expect(replyText(unknownCtx.reply)).toBe('<:search:search-id> Não encontrei esse usuário.');
    expect(unknown.ban).not.toHaveBeenCalled();
  });

  it('checks hierarchy again when the account joins before the ban', async () => {
    const guild = moderation({
      members: { [TARGET]: null },
      fetchUser: vi.fn(async () => user(TARGET, 'Fora')),
    });
    const joined = profile(TARGET, 'Alvo', 90);
    const fetchMember = guild.fetchMember;
    let targetReads = 0;
    guild.fetchMember = async (userId) => {
      if (userId !== TARGET) return fetchMember(userId);
      targetReads += 1;
      return targetReads === 1 ? null : joined;
    };
    const ctx = context({ memberModeration: guild, rawArgs: TARGET });
    await banCommand.execute(ctx);

    expect(replyText(ctx.reply)).toBe('<:Disappointed:Disappointed-id> Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode simplesmente bani-lo.');
    expect(guild.ban).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'question', 'Diga quem banir. Mencione o membro ou digite o ID!'],
    ['pessoa', 'search', 'Não consegui identificar esse membro. Mencione alguém ou informe um ID válido.'],
    [`${TARGET} ${'x'.repeat(201)}`, 'warning', 'O motivo pode ter no máximo **200** caracteres.'],
  ])('rejects prefix input %j before any ban', async (rawArgs, emoji, text) => {
    const guild = moderation();
    const ctx = context({ rawArgs, memberModeration: guild });
    await banCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe(`<:${emoji}:${emoji}-id> ${text}`);
    expect(guild.ban).not.toHaveBeenCalled();
  });

  it('refuses to ban the author, the bot, the owner or a higher role', async () => {
    const cases: Array<{ rawArgs: string; members?: Record<string, GuildMemberProfile>; text: string }> = [
      { rawArgs: `<@${ACTOR}>`, text: '<:Disappointed:Disappointed-id> Você não pode se banir... Por que você estaria tentando banir você mesmo?' },
      { rawArgs: `<@${BOT}>`, text: '<:cry:cry-id> Ei! Por que você está tentando me banir?' },
      { rawArgs: `<@${OWNER}>`, text: '<:Disappointed:Disappointed-id> Não consigo banir o dono deste servidor.' },
      {
        rawArgs: `<@${TARGET}>`,
        members: { [TARGET]: profile(TARGET, 'Alvo', 5) },
        text: '<:Disappointed:Disappointed-id> Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode simplesmente bani-lo.',
      },
      {
        rawArgs: `<@${TARGET}>`,
        members: { [BOT]: profile(BOT, 'Kuruttina', 2) },
        text: '<:Angry:Angry-id> Ei! Meu cargo está abaixo desse membro ou no mesmo nível. Eu não consigo simplesmente bani-lo desse servidor.',
      },
    ];
    for (const entry of cases) {
      const guild = moderation({ ...(entry.members ? { members: entry.members } : {}) });
      const ctx = context({ rawArgs: entry.rawArgs, memberModeration: guild });
      await banCommand.execute(ctx);
      expect(replyText(ctx.reply)).toBe(entry.text);
      expect(guild.ban).not.toHaveBeenCalled();
    }
  });

  it('lets the server owner ban a member above their highest role', async () => {
    const guild = moderation({
      ownerId: ACTOR,
      members: {
        [ACTOR]: profile(ACTOR, 'Dono', 1),
        [TARGET]: profile(TARGET, 'Alvo', 50),
        [BOT]: profile(BOT, 'Kuruttina', 60),
      },
    });
    const ctx = context({ memberModeration: guild, rawArgs: TARGET });
    await banCommand.execute(ctx);
    expect(guild.ban).toHaveBeenCalledOnce();
  });

  it('reports an account Discord no longer recognizes', async () => {
    const guild = moderation({ ban: vi.fn(async () => 'unknown-user' as const) });
    const ctx = context({ memberModeration: guild });
    await banCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:search:search-id> Não encontrei esse usuário.');
    expect(ctx.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps the failure calm when Discord rejects the ban', async () => {
    const guild = moderation({
      ban: vi.fn(async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); }),
    });
    const ctx = context({ memberModeration: guild });
    await banCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:ops:ops-id> Não consegui banir esse usuário. Tente de novo daqui a pouco.');
    expect(replyText(ctx.reply)).not.toContain('50013');
  });

  it('denies the command when the author lacks Ban Members', async () => {
    const guild = moderation();
    const ctx = context({
      memberModeration: guild,
      memberPermissions: { has: (permission) => permission !== PermissionFlagsBits.BanMembers },
    });
    await banCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:Disappointed:Disappointed-id> Você precisa da permissão **Banir membros** neste servidor.');
    expect(guild.ban).not.toHaveBeenCalled();
  });

  it('strips backticks from the visible name and reason', async () => {
    const guild = moderation({
      members: {
        [TARGET]: profile(TARGET, 'Al`vo', 1),
        [ACTOR]: profile(ACTOR, 'M`od', 5),
      },
    });
    const ctx = context({ memberModeration: guild, rawArgs: `<@${TARGET}> moti\`vo` });
    await banCommand.execute(ctx);
    const message = sentMessage(ctx) as Exclude<CommandReply, string>;
    expect(message.content).toContain('`Alvo`');
    expect(message.embeds[0]?.fields?.[2]?.value).toBe('`motivo`');
    expect(message.content).not.toContain('`vo`');
  });
});

describe('unban command', () => {
  it('parses a mention and an optional reason', () => {
    expect(parseUnbanPrefixArgs(`<@${TARGET}> revisão`)).toEqual({ ok: true, userId: TARGET, reason: 'revisão' });
    expect(parseUnbanPrefixArgs(TARGET)).toEqual({ ok: true, userId: TARGET });
    expect(parseUnbanPrefixArgs('')).toEqual({ ok: false, reason: 'missing' });
  });

  it('publishes unban with the Banir membros permission', () => {
    const json = unbanCommand.data.toJSON();
    expect(json.name).toBe('unban');
    expect(json.description).toBe('Revoga o banimento de um usuário');
    expect(json.default_member_permissions).toBe(String(PermissionFlagsBits.BanMembers));
    expect(json.options?.map((option) => option.name)).toEqual(['membro', 'motivo']);
  });

  it('revokes an active ban and publishes the confirmation', async () => {
    const guild = moderation({ fetchBan: vi.fn(async () => user(TARGET, 'Fora')) });
    const ctx = context({ memberModeration: guild, rawArgs: `<@${TARGET}> motivo claro` });
    await unbanCommand.execute(ctx);

    expect(guild.unban).toHaveBeenCalledWith(TARGET, `Moderador ${ACTOR}: motivo claro`);
    expect(guild.ban).not.toHaveBeenCalled();
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '<:happy:happy-id> <:sucess:sucess-id> Pronto. O banimento de `Fora` foi revogado.',
      embeds: [{
        color: 0x2b2d31,
        fields: [
          { name: '<:ID:ID-id> Usuário', value: '`Fora`\n`222222222222222222`', inline: true },
          { name: '<:staff:staff-id> Responsável', value: '`Mod`\n`111111111111111111`', inline: true },
          { name: '<:Note:Note-id> Motivo', value: '`motivo claro`', inline: false },
        ],
      }],
    });
    expect(ctx.deleteReply).toHaveBeenCalledOnce();
  });

  it('keeps the revocation readable when custom emojis are unavailable', async () => {
    const ctx = context({
      rawArgs: TARGET,
      memberModeration: moderation({ fetchBan: vi.fn(async () => user(TARGET, 'Fora')) }),
      emoji: createEmojiResolver({ emojis: { fetch: vi.fn().mockRejectedValue(new Error('Unavailable')) } }),
    });
    await unbanCommand.execute(ctx);
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '✅ Pronto. O banimento de `Fora` foi revogado.',
      embeds: [{
        fields: [
          { name: '🪪 Usuário' },
          { name: 'Responsável' },
          { name: 'Motivo', value: 'Nenhum motivo informado.' },
        ],
      }],
    });
  });

  it('reads the slash user and an optional reason', async () => {
    const guild = moderation({ fetchBan: vi.fn(async () => user(TARGET, 'Fora')) });
    const ctx = context({
      rawArgs: undefined,
      options: [{ name: 'membro', value: TARGET }, { name: 'motivo', value: '  aviso  ' }],
      memberModeration: guild,
    });
    await unbanCommand.execute(ctx);
    expect(guild.unban).toHaveBeenCalledWith(TARGET, `Moderador ${ACTOR}: aviso`);
  });

  it.each([
    ['', 'question', 'Diga de quem revogar o banimento. Mencione o usuário ou digite o ID!'],
    ['pessoa', 'search', 'Não consegui identificar esse membro. Mencione alguém ou informe um ID válido.'],
    [`${TARGET} ${'x'.repeat(201)}`, 'warning', 'O motivo pode ter no máximo **200** caracteres.'],
  ])('rejects prefix input %j before any unban', async (rawArgs, emoji, text) => {
    const guild = moderation({ fetchBan: vi.fn(async () => user(TARGET, 'Fora')) });
    const ctx = context({ rawArgs, memberModeration: guild });
    await unbanCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe(`<:${emoji}:${emoji}-id> ${text}`);
    expect(guild.unban).not.toHaveBeenCalled();
  });

  it('refuses to revoke the author or the bot, and skips a user who is not banned', async () => {
    const self = moderation();
    const selfCtx = context({ memberModeration: self, rawArgs: `<@${ACTOR}>` });
    await unbanCommand.execute(selfCtx);
    expect(replyText(selfCtx.reply)).toBe('<:Disappointed:Disappointed-id> Como você estaria tentando revogar o seu próprio banimento?');

    const bot = moderation();
    const botCtx = context({ memberModeration: bot, rawArgs: `<@${BOT}>` });
    await unbanCommand.execute(botCtx);
    expect(replyText(botCtx.reply)).toBe('<:Disappointed:Disappointed-id> Ei! Eu nem estou banida, então como você estaria tentando revogar o meu banimento?');

    const clear = moderation();
    const clearCtx = context({ memberModeration: clear, rawArgs: TARGET });
    await unbanCommand.execute(clearCtx);
    expect(replyText(clearCtx.reply)).toBe('<:search:search-id> Ei! Esse usuário não está nem sequer banido.');
    expect(clear.unban).not.toHaveBeenCalled();
    expect(self.unban).not.toHaveBeenCalled();
    expect(bot.unban).not.toHaveBeenCalled();
  });

  it('reports a ban that disappears before the revocation completes', async () => {
    const guild = moderation({
      fetchBan: vi.fn(async () => user(TARGET, 'Fora')),
      unban: vi.fn(async () => 'not-banned' as const),
    });
    const ctx = context({ memberModeration: guild, rawArgs: TARGET });
    await unbanCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:search:search-id> Ei! Esse usuário não está nem sequer banido.');
    expect(ctx.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps the failure calm when Discord rejects the revocation', async () => {
    const guild = moderation({
      fetchBan: vi.fn(async () => user(TARGET, 'Fora')),
      unban: vi.fn(async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); }),
    });
    const ctx = context({ memberModeration: guild, rawArgs: TARGET });
    await unbanCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:ops:ops-id> Não consegui revogar o banimento desse usuário. Tente de novo daqui a pouco.');
    expect(replyText(ctx.reply)).not.toContain('50013');
  });

  it('denies the command when the author lacks Ban Members', async () => {
    const guild = moderation({ fetchBan: vi.fn(async () => user(TARGET, 'Fora')) });
    const ctx = context({
      memberModeration: guild,
      memberPermissions: { has: (permission) => permission !== PermissionFlagsBits.BanMembers },
    });
    await unbanCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:Disappointed:Disappointed-id> Você precisa da permissão **Banir membros** neste servidor.');
    expect(guild.unban).not.toHaveBeenCalled();
  });
});

describe('member ban adapter', () => {
  function discordUser(id: string, name: string) {
    return { id, displayName: name };
  }

  it('bans and unbans by id without treating an unknown account as a transport failure', async () => {
    const ban = vi.fn(async (userId: string) => {
      if (userId === TARGET) throw Object.assign(new Error('Unknown User'), { code: 10013 });
      return userId;
    });
    const unban = vi.fn(async (userId: string) => {
      if (userId === TARGET) throw Object.assign(new Error('Unknown Ban'), { code: 10026 });
      return discordUser(userId, 'Fora');
    });
    const guild = {
      ownerId: OWNER,
      client: {
        users: {
          fetch: vi.fn(async (userId: string) => {
            if (userId === TARGET) throw Object.assign(new Error('Unknown User'), { code: 10013 });
            return discordUser(userId, 'Conta');
          }),
        },
      },
      bans: {
        fetch: vi.fn(async (userId: string) => {
          if (userId === TARGET) throw Object.assign(new Error('Unknown Ban'), { code: 10026 });
          return { user: discordUser(userId, 'Banido') };
        }),
      },
      members: {
        me: { id: BOT },
        ban,
        unban,
      },
    };
    const port = createMemberModerationAdapter(guild as unknown as Guild);
    expect(await port.fetchUser(TARGET)).toBeNull();
    expect(await port.fetchUser(ACTOR)).toEqual({ id: ACTOR, displayName: 'Conta' });
    expect(await port.fetchBan(TARGET)).toBeNull();
    expect(await port.fetchBan(ACTOR)).toEqual({ id: ACTOR, displayName: 'Banido' });
    expect(await port.ban(TARGET, 'Moderador')).toBe('unknown-user');
    expect(await port.ban(ACTOR, 'Moderador')).toBe('banned');
    expect(ban).toHaveBeenCalledWith(ACTOR, { deleteMessageSeconds: 0, reason: 'Moderador' });
    expect(await port.unban(TARGET, 'Moderador')).toBe('not-banned');
    expect(await port.unban(ACTOR, 'Moderador')).toBe('unbanned');
    expect(unban).toHaveBeenCalledWith(ACTOR, 'Moderador');
  });

  it('propagates an unexpected Discord failure', async () => {
    const guild = {
      ownerId: OWNER,
      client: { users: { fetch: vi.fn(async () => { throw Object.assign(new Error('Missing Access'), { code: 50001 }); }) } },
      bans: { fetch: vi.fn(async () => { throw Object.assign(new Error('Missing Access'), { code: 50001 }); }) },
      members: {
        me: { id: BOT },
        ban: vi.fn(async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); }),
        unban: vi.fn(async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); }),
      },
    };
    const port = createMemberModerationAdapter(guild as unknown as Guild);
    await expect(port.fetchUser(TARGET)).rejects.toMatchObject({ code: 50001 });
    await expect(port.fetchBan(TARGET)).rejects.toMatchObject({ code: 50001 });
    await expect(port.ban(TARGET, 'Moderador')).rejects.toMatchObject({ code: 50013 });
    await expect(port.unban(TARGET, 'Moderador')).rejects.toMatchObject({ code: 50013 });
  });
});
