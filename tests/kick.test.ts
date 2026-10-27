import { PermissionFlagsBits, type Guild } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { command as kickCommand, parseKickPrefixArgs } from '../apps/bot/src/commands/mod/kick.js';
import type { CommandContext, CommandReply, GuildMemberProfile, MemberModerationPort } from '../apps/bot/src/command-system/types.js';
import { createEmojiResolver } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import { createMemberModerationAdapter } from '../apps/bot/src/infrastructure/discord/moderation/memberModerationAdapter.js';
import { createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';

const ACTOR = '111111111111111111';
const TARGET = '222222222222222222';
const BOT = '333333333333333333';
const OWNER = '444444444444444444';

function profile(id: string, name: string, position: number): GuildMemberProfile {
  return { id, displayName: name, highestRolePosition: position, administrator: false, timedOutUntil: null };
}

function moderation(options: {
  members?: Record<string, GuildMemberProfile | null>;
  kick?: MemberModerationPort['kick'];
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
    kick: options.kick ?? vi.fn(async () => 'kicked' as const),
    timeout: vi.fn(async () => 'timed-out' as const),
    clearTimeout: vi.fn(async () => 'cleared' as const),
    fetchUser: vi.fn(async () => null),
    fetchBan: vi.fn(async () => null),
    ban: vi.fn(async () => 'banned' as const),
    unban: vi.fn(async () => 'unbanned' as const),
  };
}

function context(overrides: Partial<CommandContext> = {}): CommandContext {
  const allowed = { has: () => true };
  const emoji = vi.fn(async (name: string) => `<:${name}:${name}-id>`);
  return {
    userId: ACTOR,
    guildId: 'guild-id',
    apiPing: 1,
    gatewayPing: 1,
    render: createRenderer(overrides.emoji ?? emoji),
    acknowledge: vi.fn(async () => undefined),
    emoji,
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

describe('kick command', () => {
  it('parses a mention, a snowflake and a spaced reason', () => {
    expect(parseKickPrefixArgs(`<@${TARGET}> quebrou a regra`)).toEqual({
      ok: true,
      userId: TARGET,
      reason: 'quebrou a regra',
    });
    expect(parseKickPrefixArgs(`<@!${TARGET}>`)).toEqual({ ok: true, userId: TARGET });
    expect(parseKickPrefixArgs(TARGET)).toEqual({ ok: true, userId: TARGET });
  });

  it('rejects an empty call, an invalid member and a long reason', () => {
    expect(parseKickPrefixArgs('   ')).toEqual({ ok: false, reason: 'missing' });
    expect(parseKickPrefixArgs('alguem')).toEqual({ ok: false, reason: 'invalid-user' });
    expect(parseKickPrefixArgs(`${TARGET} ${'a'.repeat(201)}`)).toEqual({ ok: false, reason: 'reason-too-long' });
  });

  it('publishes kick with the Expulsar membros permission', () => {
    const json = kickCommand.data.toJSON();
    expect(json.name).toBe('kick');
    expect(json.description).toBe('Expulsa um membro do servidor');
    expect(json.default_member_permissions).toBe(String(PermissionFlagsBits.KickMembers));
    expect(json.options?.map((option) => option.name)).toEqual(['membro', 'motivo']);
  });

  it('kicks the member and publishes the confirmation embed', async () => {
    const guild = moderation();
    const ctx = context({ memberModeration: guild });
    await kickCommand.execute(ctx);

    expect(guild.kick).toHaveBeenCalledWith(TARGET, `Moderador ${ACTOR}: motivo claro`);
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '<:sucess:sucess-id> Pronto. `Alvo` foi expulso deste servidor. <:kick:kick-id>',
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
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('keeps the confirmation readable when custom emojis are unavailable', async () => {
    const ctx = context({
      rawArgs: `<@${TARGET}>`,
      emoji: createEmojiResolver({ emojis: { fetch: vi.fn().mockRejectedValue(new Error('Unavailable')) } }),
    });
    await kickCommand.execute(ctx);
    const message = sentMessage(ctx);
    expect(message).toMatchObject({
      content: '✅ Pronto. `Alvo` foi expulso deste servidor.',
      embeds: [{
        fields: [
          { name: '🪪 Membro', value: '`Alvo`\n`222222222222222222`' },
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
    await kickCommand.execute(ctx);
    expect(guild.kick).toHaveBeenCalledWith(TARGET, `Moderador ${ACTOR}: aviso`);
  });

  it.each([
    ['', 'question', 'Diga quem expulsar. Mencione o membro ou digite o ID!'],
    ['pessoa', 'search', 'Não consegui identificar esse membro. Mencione alguém ou informe um ID válido.'],
    [`${TARGET} ${'x'.repeat(201)}`, 'warning', 'O motivo pode ter no máximo **200** caracteres.'],
  ])('rejects prefix input %j before any kick', async (rawArgs, emoji, text) => {
    const guild = moderation();
    const ctx = context({ rawArgs, memberModeration: guild });
    await kickCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe(`<:${emoji}:${emoji}-id> ${text}`);
    expect(guild.kick).not.toHaveBeenCalled();
  });

  it('refuses to kick the author, the bot, the owner or a higher role', async () => {
    const cases: Array<{ rawArgs: string; members?: Record<string, GuildMemberProfile>; text: string }> = [
      { rawArgs: `<@${ACTOR}>`, text: '<:Disappointed:Disappointed-id> Você não pode se expulsar!!' },
      { rawArgs: `<@${BOT}>`, text: '<:Angry:Angry-id> Ei! Você não pode me expulsar!!!' },
      { rawArgs: `<@${OWNER}>`, text: '<:Disappointed:Disappointed-id> Não consigo expulsar o dono deste servidor.' },
      {
        rawArgs: `<@${TARGET}>`,
        members: { [TARGET]: profile(TARGET, 'Alvo', 5) },
        text: '<:Disappointed:Disappointed-id> O cargo desse membro está acima do seu ou no mesmo nível. Você não pode expulsá-lo.',
      },
      {
        rawArgs: `<@${TARGET}>`,
        members: { [BOT]: profile(BOT, 'Kuruttina', 2) },
        text: '<:Angry:Angry-id> Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo expulsá-lo.',
      },
    ];
    for (const entry of cases) {
      const guild = moderation({ ...(entry.members ? { members: entry.members } : {}) });
      const ctx = context({ rawArgs: entry.rawArgs, memberModeration: guild });
      await kickCommand.execute(ctx);
      expect(replyText(ctx.reply)).toBe(entry.text);
      expect(guild.kick).not.toHaveBeenCalled();
    }
  });

  it('lets the server owner kick a member above their highest role', async () => {
    const guild = moderation({
      ownerId: ACTOR,
      members: {
        [ACTOR]: profile(ACTOR, 'Dono', 1),
        [TARGET]: profile(TARGET, 'Alvo', 50),
        [BOT]: profile(BOT, 'Kuruttina', 60),
      },
    });
    const ctx = context({ memberModeration: guild, rawArgs: TARGET });
    await kickCommand.execute(ctx);
    expect(guild.kick).toHaveBeenCalledOnce();
  });

  it('reports a member who is not in the server', async () => {
    const guild = moderation({ members: { [TARGET]: null } });
    const ctx = context({ memberModeration: guild });
    await kickCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:search:search-id> Não encontrei esse membro neste servidor.');
    expect(guild.kick).not.toHaveBeenCalled();
  });

  it('reports a member who leaves before the kick completes', async () => {
    const guild = moderation({ kick: vi.fn(async () => 'missing' as const) });
    const ctx = context({ memberModeration: guild });
    await kickCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:search:search-id> Não encontrei esse membro neste servidor.');
    expect(ctx.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps the failure calm when Discord rejects the kick', async () => {
    const guild = moderation({
      kick: vi.fn(async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); }),
    });
    const ctx = context({ memberModeration: guild });
    await kickCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:ops:ops-id> Não consegui expulsar esse membro. Tente de novo daqui a pouco.');
    expect(replyText(ctx.reply)).not.toContain('50013');
  });

  it('denies the command when the author lacks Kick Members', async () => {
    const guild = moderation();
    const ctx = context({
      memberModeration: guild,
      memberPermissions: { has: (permission) => permission !== PermissionFlagsBits.KickMembers },
    });
    await kickCommand.execute(ctx);
    expect(replyText(ctx.reply)).toBe('<:Disappointed:Disappointed-id> Você precisa da permissão **Expulsar membros** neste servidor.');
    expect(guild.kick).not.toHaveBeenCalled();
  });

  it('strips backticks from the visible name and reason', async () => {
    const guild = moderation({
      members: {
        [TARGET]: profile(TARGET, 'Al`vo', 1),
        [ACTOR]: profile(ACTOR, 'M`od', 5),
      },
    });
    const ctx = context({ memberModeration: guild, rawArgs: `<@${TARGET}> moti\`vo` });
    await kickCommand.execute(ctx);
    const message = sentMessage(ctx) as Exclude<CommandReply, string>;
    expect(message.content).toContain('`Alvo`');
    expect(message.embeds[0]?.fields?.[2]?.value).toBe('`motivo`');
    expect(message.content).not.toContain('`vo`');
  });
});

describe('member moderation adapter', () => {
  it('returns null for an unknown member and kicks a member who is present', async () => {
    const kick = vi.fn(async () => undefined);
    const guild = {
      ownerId: OWNER,
      members: {
        me: { id: BOT },
        fetch: vi.fn(async (userId: string) => {
          if (userId === TARGET) throw Object.assign(new Error('Unknown Member'), { code: 10007 });
          return {
            id: userId,
            displayName: 'Presente',
            roles: { highest: { position: 3 } },
            permissions: { has: () => false },
            communicationDisabledUntilTimestamp: null,
            kick,
          };
        }),
      },
    };
    const port = createMemberModerationAdapter(guild as unknown as Guild);
    expect(port.ownerId).toBe(OWNER);
    expect(port.botUserId).toBe(BOT);
    expect(await port.fetchMember(TARGET)).toBeNull();
    expect(await port.kick(ACTOR, 'Moderador')).toBe('kicked');
    expect(kick).toHaveBeenCalledWith('Moderador');
  });

  it('propagates an unexpected Discord failure', async () => {
    const guild = {
      ownerId: OWNER,
      members: {
        me: null,
        fetch: vi.fn(async () => { throw Object.assign(new Error('Missing Access'), { code: 50001 }); }),
      },
    };
    const port = createMemberModerationAdapter(guild as unknown as Guild);
    expect(port.botUserId).toBeNull();
    await expect(port.fetchMember(TARGET)).rejects.toMatchObject({ code: 50001 });
  });
});
