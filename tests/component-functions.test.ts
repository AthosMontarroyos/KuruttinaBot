import { MessageFlags } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { MessageTemplate } from '@kuruttina/message-templates';
import { log } from '#bot/infrastructure/logging/logger.js';
import {
  runComponentFunctions,
  type ComponentFunctionDeps,
  type CustomFunction,
} from '../apps/bot/src/infrastructure/discord/messages/componentFunctions.js';

vi.mock('#bot/infrastructure/logging/logger.js', () => ({ log: vi.fn() }));

const emoji = async (name: string): Promise<string> => `[${name}]`;

const GUILD_ID = '666948364507545600';
const USER_ID = '100000000000000001';
const TEXT_CHANNEL_ID = '200000000000000001';
const VOICE_CHANNEL_ID = '200000000000000002';
const MISSING_CHANNEL_ID = '200000000000000009';
const ROLE_A = '300000000000000001';
const ROLE_B = '300000000000000002';
const ROLE_MANAGED = '300000000000000004';
const ROLE_ABOVE_BOT = '300000000000000005';
const ROLE_GONE = '300000000000000006';

const simpleTemplate: MessageTemplate = { content: 'Olá!', embeds: [], components: [] };
const templates: Record<string, MessageTemplate> = { ok: simpleTemplate };

interface FakeRole {
  readonly id: string;
  readonly managed: boolean;
  readonly editable: boolean;
}

function role(id: string, options: { managed?: boolean; editable?: boolean } = {}): FakeRole {
  return { id, managed: options.managed ?? false, editable: options.editable ?? true };
}

function makeMember(roles: readonly FakeRole[], voiceChannelId: string | null = null) {
  return {
    roles: {
      cache: new Map(roles.map((item) => [item.id, item] as const)),
      add: vi.fn(async (_roles?: unknown) => undefined),
      remove: vi.fn(async (_roles?: unknown) => undefined),
    },
    voice: { channelId: voiceChannelId, setChannel: vi.fn(async (_channel?: unknown) => undefined) },
  };
}

function makeChannel(id: string, options: { text?: boolean; voice?: boolean; guildId?: string } = {}) {
  return {
    id,
    guildId: options.guildId ?? GUILD_ID,
    isTextBased: () => options.text ?? false,
    isVoiceBased: () => options.voice ?? false,
    send: vi.fn(async (_payload?: unknown) => undefined),
  };
}

function makeGuild(options: {
  channels?: readonly ReturnType<typeof makeChannel>[];
  roles?: readonly FakeRole[];
  member?: ReturnType<typeof makeMember>;
}) {
  const channelMap = new Map((options.channels ?? []).map((channel) => [channel.id, channel] as const));
  const roleMap = new Map((options.roles ?? []).map((item) => [item.id, item] as const));
  const member = options.member ?? makeMember([]);
  return {
    id: GUILD_ID,
    name: 'Servidor de teste',
    memberCount: 10,
    iconURL: () => null,
    bannerURL: () => null,
    channels: { fetch: vi.fn(async (id: string) => channelMap.get(id) ?? null) },
    roles: { fetch: vi.fn(async (id: string) => roleMap.get(id) ?? null) },
    members: { fetch: vi.fn(async () => member) },
  };
}

function makeInteraction(guild: ReturnType<typeof makeGuild>, overrides: { deferred?: boolean } = {}) {
  return {
    customId: 'kt:btn:1',
    guildId: GUILD_ID,
    guild,
    member: null,
    deferred: overrides.deferred ?? false,
    replied: false,
    user: {
      id: USER_ID,
      displayName: 'Ana',
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/a.png',
      send: vi.fn(async (_payload?: unknown) => undefined),
    },
    message: { delete: vi.fn(async () => undefined) },
    deferUpdate: vi.fn(async () => undefined),
    followUp: vi.fn(async (_payload?: unknown) => undefined),
    editReply: vi.fn(async (_payload?: unknown) => undefined),
  };
}

function makeDeps(): ComponentFunctionDeps {
  return {
    getTemplate: vi.fn(async (_guildId: string, name: string) => {
      const content = templates[name];
      return content === undefined ? null : { content };
    }),
    emoji,
  };
}

async function run(
  interaction: ReturnType<typeof makeInteraction>,
  functions: readonly CustomFunction[],
): Promise<void> {
  await runComponentFunctions(interaction as never, functions, makeDeps());
}

/** Texto de cada followUp enviado. */
function followUpContents(interaction: ReturnType<typeof makeInteraction>): string[] {
  return vi.mocked(interaction.followUp).mock.calls.map(([payload]) => (payload as { content: string }).content);
}

const PARTIAL_ROLES = '[ops] Não consegui alterar alguns cargos (estão acima do meu cargo ou são de integração).';

describe('runComponentFunctions', () => {
  it('defers the click once, before any other call', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [{ type: 'send_message', config: { template: 'ok' } }]);

    expect(interaction.deferUpdate).toHaveBeenCalledOnce();
    expect(interaction.deferUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      interaction.followUp.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('does not defer again when the interaction is already acknowledged', async () => {
    const interaction = makeInteraction(makeGuild({}), { deferred: true });

    await run(interaction, [{ type: 'send_message', config: { template: 'ok' } }]);

    expect(interaction.deferUpdate).not.toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalledOnce();
  });

  it('send_message sends the template as a followUp, public by default', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [{ type: 'send_message', config: { template: 'ok', ephemeral: false } }]);

    const [payload] = vi.mocked(interaction.followUp).mock.calls[0] ?? [];
    expect(payload).toEqual(expect.objectContaining({ content: 'Olá!', allowedMentions: { parse: [] } }));
    expect(payload).not.toHaveProperty('flags');
  });

  it('send_message is ephemeral when the function asks for it', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [{ type: 'send_message', config: { template: 'ok', ephemeral: true } }]);

    expect(interaction.followUp).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: 'Olá!', flags: MessageFlags.Ephemeral }),
    );
  });

  it('send_channel_message sends the template to a text channel of the same guild', async () => {
    const channel = makeChannel(TEXT_CHANNEL_ID, { text: true });
    const interaction = makeInteraction(makeGuild({ channels: [channel] }));

    await run(interaction, [{ type: 'send_channel_message', config: { template: 'ok', channelId: TEXT_CHANNEL_ID } }]);

    expect(channel.send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: 'Olá!', allowedMentions: { parse: [] } }),
    );
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('send_channel_message reports a missing channel as gone', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [{ type: 'send_channel_message', config: { template: 'ok', channelId: MISSING_CHANNEL_ID } }]);

    expect(followUpContents(interaction)).toEqual(['[search] O canal desta ação não existe mais.']);
  });

  it('send_channel_message reports missing send permission', async () => {
    const channel = makeChannel(TEXT_CHANNEL_ID, { text: true });
    vi.mocked(channel.send).mockRejectedValueOnce(Object.assign(new Error('forbidden'), { code: 50013 }));
    const interaction = makeInteraction(makeGuild({ channels: [channel] }));

    await run(interaction, [{ type: 'send_channel_message', config: { template: 'ok', channelId: TEXT_CHANNEL_ID } }]);

    expect(followUpContents(interaction)).toEqual(['[ops] Não tenho permissão para enviar neste canal.']);
  });

  it('edit_message edits the clicked message with the template', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [{ type: 'edit_message', config: { template: 'ok' } }]);

    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: 'Olá!', allowedMentions: { parse: [] } }),
    );
  });

  it('delete_message deletes the clicked message without a followUp', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [{ type: 'delete_message', config: {} }]);

    expect(interaction.message.delete).toHaveBeenCalledOnce();
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('skips edit_message after delete_message in the same click, without error', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [
      { type: 'delete_message', config: {} },
      { type: 'edit_message', config: { template: 'ok' } },
    ]);

    expect(interaction.message.delete).toHaveBeenCalledOnce();
    expect(interaction.editReply).not.toHaveBeenCalled();
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('dm_user sends the template in DM with no mentions', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [{ type: 'dm_user', config: { template: 'ok' } }]);

    expect(interaction.user.send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: 'Olá!', allowedMentions: { parse: [] } }),
    );
  });

  it('dm_user reports a closed DM as a failure', async () => {
    const interaction = makeInteraction(makeGuild({}));
    vi.mocked(interaction.user.send).mockRejectedValueOnce(new Error('closed'));

    await run(interaction, [{ type: 'dm_user', config: { template: 'ok' } }]);

    expect(followUpContents(interaction)).toEqual([
      '[ops] Não consegui mandar DM. Suas mensagens diretas podem estar fechadas.',
    ]);
  });

  it('move_users_in_voice moves the clicking member to the target voice channel', async () => {
    const voiceChannel = makeChannel(VOICE_CHANNEL_ID, { voice: true });
    const member = makeMember([], TEXT_CHANNEL_ID);
    const interaction = makeInteraction(makeGuild({ channels: [voiceChannel], member }));

    await run(interaction, [{ type: 'move_users_in_voice', config: { channelId: VOICE_CHANNEL_ID } }]);

    expect(member.voice.setChannel).toHaveBeenCalledExactlyOnceWith(voiceChannel);
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('move_users_in_voice asks the member to join a voice channel first', async () => {
    const voiceChannel = makeChannel(VOICE_CHANNEL_ID, { voice: true });
    const member = makeMember([], null);
    const interaction = makeInteraction(makeGuild({ channels: [voiceChannel], member }));

    await run(interaction, [{ type: 'move_users_in_voice', config: { channelId: VOICE_CHANNEL_ID } }]);

    expect(member.voice.setChannel).not.toHaveBeenCalled();
    expect(followUpContents(interaction)).toEqual(['[ops] Entre em um canal de voz primeiro.']);
  });

  it('add_roles gives the editable role and ignores a deleted one silently', async () => {
    const member = makeMember([]);
    const interaction = makeInteraction(makeGuild({ roles: [role(ROLE_A)], member }));

    await run(interaction, [{ type: 'add_roles', config: { roleIds: [ROLE_A, ROLE_GONE] } }]);

    expect(member.roles.add).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: ROLE_A })]);
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('remove_roles takes the listed roles', async () => {
    const member = makeMember([role(ROLE_A), role(ROLE_B)]);
    const interaction = makeInteraction(makeGuild({ roles: [role(ROLE_A)], member }));

    await run(interaction, [{ type: 'remove_roles', config: { roleIds: [ROLE_A] } }]);

    expect(member.roles.remove).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: ROLE_A })]);
    expect(member.roles.add).not.toHaveBeenCalled();
  });

  it('toggle_roles removes the role the member has and adds the one they lack', async () => {
    const member = makeMember([role(ROLE_A)]);
    const interaction = makeInteraction(makeGuild({ roles: [role(ROLE_A), role(ROLE_B)], member }));

    await run(interaction, [{ type: 'toggle_roles', config: { roleIds: [ROLE_A, ROLE_B] } }]);

    expect(member.roles.remove).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: ROLE_A })]);
    expect(member.roles.add).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: ROLE_B })]);
  });

  it('set_roles removes the extra editable roles, adds the missing ones and never touches non-editable roles', async () => {
    const member = makeMember([
      role(ROLE_A),
      role(ROLE_MANAGED, { managed: true }),
      role(ROLE_ABOVE_BOT, { editable: false }),
      role(GUILD_ID),
    ]);
    const roles = [role(ROLE_A), role(ROLE_B), role(ROLE_MANAGED, { managed: true }), role(ROLE_ABOVE_BOT, { editable: false })];
    const interaction = makeInteraction(makeGuild({ roles, member }));

    await run(interaction, [{ type: 'set_roles', config: { roleIds: [ROLE_B] } }]);

    expect(member.roles.remove).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: ROLE_A })]);
    expect(member.roles.add).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: ROLE_B })]);
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('set_roles reports a listed role it cannot change and still removes the extra editable ones', async () => {
    const member = makeMember([role(ROLE_A), role(ROLE_ABOVE_BOT, { editable: false })]);
    const roles = [role(ROLE_A), role(ROLE_ABOVE_BOT, { editable: false })];
    const interaction = makeInteraction(makeGuild({ roles, member }));

    await run(interaction, [{ type: 'set_roles', config: { roleIds: [ROLE_ABOVE_BOT] } }]);

    expect(member.roles.remove).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: ROLE_A })]);
    expect(member.roles.add).not.toHaveBeenCalled();
    expect(followUpContents(interaction)).toEqual([PARTIAL_ROLES]);
  });

  it('add_roles reports the roles it could not change and still adds the others', async () => {
    const member = makeMember([]);
    const interaction = makeInteraction(makeGuild({ roles: [role(ROLE_A), role(ROLE_MANAGED, { managed: true })], member }));

    await run(interaction, [{ type: 'add_roles', config: { roleIds: [ROLE_A, ROLE_MANAGED] } }]);

    expect(member.roles.add).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: ROLE_A })]);
    expect(followUpContents(interaction)).toEqual([PARTIAL_ROLES]);
  });

  it('role actions report a general role permission error', async () => {
    const member = makeMember([]);
    vi.mocked(member.roles.add).mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 50013 }));
    const interaction = makeInteraction(makeGuild({ roles: [role(ROLE_A)], member }));

    await run(interaction, [{ type: 'add_roles', config: { roleIds: [ROLE_A] } }]);

    expect(followUpContents(interaction)).toEqual(['[ops] Não tenho permissão para gerenciar cargos.']);
  });

  it('shows a single failure followUp and still runs the other functions when a template is gone', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [
      { type: 'send_message', config: { template: 'gone' } },
      { type: 'edit_message', config: { template: 'ok' } },
    ]);

    expect(interaction.editReply).toHaveBeenCalledOnce();
    expect(interaction.followUp).toHaveBeenCalledOnce();
    expect(interaction.followUp).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '[search] O template desta ação não existe mais.', flags: MessageFlags.Ephemeral }),
    );
  });

  it('a failing function does not stop the next ones', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [
      { type: 'send_channel_message', config: { template: 'ok', channelId: MISSING_CHANNEL_ID } },
      { type: 'dm_user', config: { template: 'ok' } },
    ]);

    expect(interaction.user.send).toHaveBeenCalledOnce();
    expect(interaction.followUp).toHaveBeenCalledOnce();
  });

  it('reports only the first failure when several functions fail', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [
      { type: 'send_channel_message', config: { template: 'ok', channelId: MISSING_CHANNEL_ID } },
      { type: 'send_message', config: { template: 'gone' } },
    ]);

    expect(followUpContents(interaction)).toEqual(['[search] O canal desta ação não existe mais.']);
  });

  it('reports an unknown function type as a failure and runs the next ones', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [
      { type: 'do_magic', config: {} },
      { type: 'edit_message', config: { template: 'ok' } },
    ]);

    expect(followUpContents(interaction)).toEqual(['[ops] Função desconhecida.']);
    expect(interaction.editReply).toHaveBeenCalledOnce();
  });

  it('logs each failed function by type and error name', async () => {
    const interaction = makeInteraction(makeGuild({}));

    await run(interaction, [
      { type: 'send_message', config: { template: 'gone' } },
      { type: 'do_magic', config: {} },
    ]);

    expect(vi.mocked(log)).toHaveBeenCalledWith('error', 'component_function_failed', {
      type: 'send_message',
      errorName: 'ComponentFunctionError',
    });
    expect(vi.mocked(log)).toHaveBeenCalledWith('error', 'component_function_failed', {
      type: 'do_magic',
      errorName: 'ComponentFunctionError',
    });
  });

  it('sends no mentions in any payload', async () => {
    const channel = makeChannel(TEXT_CHANNEL_ID, { text: true });
    const interaction = makeInteraction(makeGuild({ channels: [channel] }));

    await run(interaction, [
      { type: 'send_message', config: { template: 'ok' } },
      { type: 'send_channel_message', config: { template: 'ok', channelId: TEXT_CHANNEL_ID } },
      { type: 'edit_message', config: { template: 'ok' } },
      { type: 'dm_user', config: { template: 'ok' } },
    ]);

    const payloads = [
      vi.mocked(interaction.followUp).mock.calls[0]?.[0],
      vi.mocked(channel.send).mock.calls[0]?.[0],
      vi.mocked(interaction.editReply).mock.calls[0]?.[0],
      vi.mocked(interaction.user.send).mock.calls[0]?.[0],
    ];
    for (const payload of payloads) {
      expect(payload).toEqual(expect.objectContaining({ allowedMentions: { parse: [] } }));
    }
  });
});
