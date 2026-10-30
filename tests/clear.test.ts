import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { command as clearCommand, parsePrefixArgs } from '../apps/bot/src/commands/mod/clear.js';
import { createEmojiResolver } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import type { CommandContext, BulkDeletePort } from '../apps/bot/src/command-system/types.js';
import { createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';

afterEach(() => vi.restoreAllMocks());

function mockBulkDeletePort(overrides: Partial<BulkDeletePort> = {}): BulkDeletePort {
  return {
    isThread: false,
    fetchMessages: vi.fn(async () => []),
    bulkDelete: vi.fn(async (messages) => messages.length),
    deleteMessage: vi.fn(async () => true),
    ...overrides,
  };
}

function mockContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const reply = vi.fn().mockResolvedValue(undefined);
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  const deleteReply = vi.fn().mockResolvedValue(undefined);
  const port = mockBulkDeletePort();
  const emoji = overrides.emoji ?? vi.fn(async (name: string) => `<:${name}:${name}-id>`);
  return {
    apiPing: 42,
    gatewayPing: 84,
    acknowledge: vi.fn().mockResolvedValue(undefined),
    reply,
    sendMessage,
    deleteReply,
    memberPermissions: { has: vi.fn(() => true) },
    appPermissions: { has: vi.fn(() => true) },
    guildId: 'guild-123',
    channelId: 'channel-123',
    textChannel: port,
    ...overrides,
    emoji,
    render: overrides.render ?? createRenderer(emoji),
  };
}

function permsWithFlags(...flags: bigint[]): { has(permission: bigint, checkAdmin?: boolean): boolean } {
  let bitfield = 0n;
  for (const flag of flags) bitfield |= flag;
  return new PermissionsBitField(bitfield);
}

describe('clear command', () => {
  describe('parsePrefixArgs', () => {
    it('parses a simple count', () => {
      expect(parsePrefixArgs('50')).toEqual({ count: 50 });
    });

    it('parses count with user mention', () => {
      expect(parsePrefixArgs('100 <@123456789012345678>')).toEqual({
        count: 100,
        userId: '123456789012345678',
      });
    });

    it('parses count with nick mention', () => {
      expect(parsePrefixArgs('25 <@!123456789012345678>')).toEqual({
        count: 25,
        userId: '123456789012345678',
      });
    });

    it('parses count with raw user ID', () => {
      expect(parsePrefixArgs('75 123456789012345678')).toEqual({
        count: 75,
        userId: '123456789012345678',
      });
    });

    it('rejects zero', () => {
      expect(parsePrefixArgs('0')).toEqual({ count: 0 });
    });

    it('rejects negative', () => {
      expect(parsePrefixArgs('-5')).toEqual({ count: 0 });
    });

    it('rejects over 200', () => {
      expect(parsePrefixArgs('201')).toEqual({ count: 0 });
    });

    it('rejects decimal', () => {
      expect(parsePrefixArgs('10.5')).toEqual({ count: 0 });
    });

    it('rejects non-numeric', () => {
      expect(parsePrefixArgs('abc')).toEqual({ count: 0 });
    });

    it('rejects empty string', () => {
      expect(parsePrefixArgs('')).toEqual({ count: 0 });
    });

    it('handles extra whitespace', () => {
      expect(parsePrefixArgs('  50  ')).toEqual({ count: 50 });
    });

    it('preserves an invalid user for shared validation', () => {
      expect(parsePrefixArgs('50 invalid')).toEqual({ count: 50, userId: 'invalid' });
    });
  });

  describe('command data', () => {
    it('has correct name and description', () => {
      expect(clearCommand.data.name).toBe('clear');
      expect(clearCommand.data.toJSON().description).toBeTruthy();
    });

    it('requires ManageMessages permission', () => {
      const json = clearCommand.data.toJSON();
      expect(json.default_member_permissions).toBe(String(1n << 13n));
    });
  });

  describe('execute', () => {
    it('keeps deleting with the cleaning fallback and omits slap when emoji lookup fails', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [{ id: 'msg-1', createdTimestamp: Date.now(), author: { id: 'user-1' } }]),
      });
      const ctx = mockContext({
        textChannel: port,
        rawArgs: '20',
        emoji: createEmojiResolver({ emojis: { fetch: vi.fn().mockRejectedValue(new Error('Unavailable')) } }),
      });
      await clearCommand.execute(ctx);
      expect(port.bulkDelete).toHaveBeenCalledOnce();
      expect(ctx.sendMessage).toHaveBeenCalledWith('🧹 Pronto. Apaguei 1 mensagem em <#channel-123>.');
    });

    it('replies in Portuguese when no text channel', async () => {
      const ctx = mockContext({ textChannel: undefined });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:ChannelBrowser:ChannelBrowser-id> A limpeza só pode ser feita em um canal de texto de servidor.');
    });

    it.each([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.Administrator])('allows a user with permission %s to fetch messages', async (permission) => {
      const ctx = mockContext({
        memberPermissions: permsWithFlags(permission), rawArgs: '1',
      });
      await clearCommand.execute(ctx);
      expect(ctx.textChannel!.fetchMessages).toHaveBeenCalledOnce();
    });

    it('rejects user without ManageMessages and without Administrator', async () => {
      const ctx = mockContext({
        memberPermissions: permsWithFlags(0n),
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        '<:Disappointed:Disappointed-id> Você precisa da permissão **Gerenciar mensagens** neste canal.',
      );
      expect(ctx.textChannel!.fetchMessages).not.toHaveBeenCalled();
    });

    it('replies when user permissions are unavailable', async () => {
      const ctx = mockContext({
        memberPermissions: undefined,
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:ops:ops-id> Não consegui conferir suas permissões. Tente de novo.');
      expect(ctx.textChannel!.fetchMessages).not.toHaveBeenCalled();
    });

    it('allows bot with all required permissions', async () => {
      const ctx = mockContext({
        rawArgs: '1',
        appPermissions: permsWithFlags(
          (1n << 10n) | (1n << 16n) | (1n << 13n) | (1n << 11n),
        ),
      });
      await clearCommand.execute(ctx);
      expect(ctx.textChannel!.fetchMessages).toHaveBeenCalledOnce();
    });

    it('allows bot with Administrator permission', async () => {
      const ctx = mockContext({
        rawArgs: '1',
        appPermissions: permsWithFlags(1n << 3n),
      });
      await clearCommand.execute(ctx);
      expect(ctx.textChannel!.fetchMessages).toHaveBeenCalledOnce();
    });

    it('rejects unavailable bot permissions with the ops emoji', async () => {
      const ctx = mockContext({
        appPermissions: undefined,
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        '<:ops:ops-id> Não consegui conferir minhas permissões neste canal. Tente de novo.',
      );
      expect(ctx.textChannel!.fetchMessages).not.toHaveBeenCalled();
    });

    it('lists missing permissions when bot lacks them', async () => {
      const ctx = mockContext({
        appPermissions: permsWithFlags(0n),
      });
      await clearCommand.execute(ctx);
      const replyArg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
      expect(replyArg).toContain('<:Angry:Angry-id>');
      expect(replyArg).toContain('Preciso destas permissões para fazer a limpeza');
      expect(replyArg).toContain('Gerenciar mensagens');
      expect(replyArg).toContain('Ler histórico');
      expect(ctx.textChannel!.fetchMessages).not.toHaveBeenCalled();
    });

    it.each([false, true])('requires the correct send permission for isThread=%s', async (isThread) => {
      const { ViewChannel, ReadMessageHistory, ManageMessages, SendMessages, SendMessagesInThreads } = PermissionFlagsBits;
      const base = [ViewChannel, ReadMessageHistory, ManageMessages];
      const ctx = mockContext({
        rawArgs: '1', textChannel: mockBulkDeletePort({ isThread }),
        appPermissions: permsWithFlags(...base, isThread ? SendMessages : SendMessagesInThreads),
      });
      await clearCommand.execute(ctx);
      expect(ctx.textChannel!.fetchMessages).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Enviar mensagens'));
      const allowed = mockContext({
        rawArgs: '1', textChannel: mockBulkDeletePort({ isThread }),
        appPermissions: permsWithFlags(...base, isThread ? SendMessagesInThreads : SendMessages),
      });
      await clearCommand.execute(allowed);
      expect(allowed.textChannel!.fetchMessages).toHaveBeenCalledOnce();
    });

    it('deletes messages via slash command and sends confirmation via sendMessage', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
          { id: 'msg-2', createdTimestamp: Date.now() - 2000, author: { id: 'user-2' } },
        ]),
        bulkDelete: vi.fn(async () => 2),
      });
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 2 }],
      });
      await clearCommand.execute(ctx);
      expect(port.bulkDelete).toHaveBeenCalledOnce();
      expect(ctx.sendMessage).toHaveBeenCalledWith('<:cleaning:cleaning-id> Pronto. Apaguei 2 mensagens em <#channel-123>. <:slap:slap-id>');
      expect(ctx.deleteReply).toHaveBeenCalledOnce();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('deletes messages via prefix and sends confirmation via sendMessage', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
        ]),
      });
      const ctx = mockContext({
        textChannel: port,
        rawArgs: '1',
        commandMessageId: 'msg-cmd',
      });
      await clearCommand.execute(ctx);
      expect(port.bulkDelete).toHaveBeenCalledWith([expect.objectContaining({ id: 'msg-1' })]);
      expect(port.deleteMessage).toHaveBeenCalledWith('msg-cmd');
      expect(ctx.sendMessage).toHaveBeenCalledWith('<:cleaning:cleaning-id> Pronto. Apaguei 1 mensagem em <#channel-123>. <:slap:slap-id>');
    });

    it('excludes the command message from deletion and deletes it after confirmation', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
          { id: 'msg-2', createdTimestamp: Date.now() - 2000, author: { id: 'user-2' } },
          { id: 'msg-3', createdTimestamp: Date.now() - 3000, author: { id: 'user-1' } },
        ]),
        bulkDelete: vi.fn(async () => 2),
      });
      const ctx = mockContext({
        textChannel: port,
        rawArgs: '2',
        commandMessageId: 'msg-cmd',
      });
      await clearCommand.execute(ctx);
      expect(port.fetchMessages).toHaveBeenCalledWith(
        expect.objectContaining({ before: 'msg-cmd' }),
      );
      // Command message deleted after confirmation
      expect(port.deleteMessage).toHaveBeenCalledWith('msg-cmd');
    });

    it('does not pass before cursor for slash commands (no commandMessageId)', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
        ]),
        bulkDelete: vi.fn(async () => 1),
      });
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 1 }],
        commandMessageId: undefined,
      });
      await clearCommand.execute(ctx);
      expect(port.fetchMessages).toHaveBeenCalledWith(
        expect.objectContaining({ before: undefined }),
      );
    });

    it('reports partial deletion in Portuguese', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
        ]),
        bulkDelete: vi.fn(async () => 0),
      });
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 5 }],
      });
      await clearCommand.execute(ctx);
      expect(ctx.sendMessage).toHaveBeenCalledWith('<:cleaning:cleaning-id> Pronto. Apaguei 0 mensagens em <#channel-123>. <:slap:slap-id>');
    });

    it('reports no eligible messages in Portuguese', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => []),
      });
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 10 }],
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:search:search-id> Não encontrei mensagens para apagar. Só consigo limpar mensagens enviadas há menos de 14 dias.');
      expect(port.bulkDelete).not.toHaveBeenCalled();
    });

    it('names the filtered user when no eligible message matches', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => []),
      });
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 10 }, { name: 'usuario', value: '123456789012345678' }],
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        '<:search:search-id> Não encontrei mensagens de <@123456789012345678> para apagar. Só consigo limpar mensagens enviadas há menos de 14 dias.',
      );
      expect(port.bulkDelete).not.toHaveBeenCalled();
    });

    it('rejects invalid count from slash in Portuguese', async () => {
      const ctx = mockContext({
        options: [{ name: 'quantidade', value: 0 }],
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:question:question-id> Diga quantas mensagens apagar: um número de **1 a 200**.');
    });

    it('rejects invalid count from prefix in Portuguese', async () => {
      const ctx = mockContext({
        rawArgs: '0',
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:question:question-id> Diga quantas mensagens apagar: um número de **1 a 200**.');
    });

    it('rejects invalid user ID in Portuguese', async () => {
      const ctx = mockContext({
        options: [
          { name: 'quantidade', value: 10 },
          { name: 'usuario', value: 'not-a-user' },
        ],
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:ID:ID-id> Não consegui identificar esse usuário. Selecione um usuário válido para a limpeza.');
    });

    it('rejects overlapping operations on the same channel but allows another channel', async () => {
      let release!: () => void;
      let started!: () => void;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      const fetching = new Promise<void>((resolve) => { started = resolve; });
      const port = mockBulkDeletePort({ fetchMessages: vi.fn(async () => { started(); await pending; return []; }) });
      const first = clearCommand.execute(mockContext({ textChannel: port, rawArgs: '1' }));
      try {
        await fetching;
        const second = mockContext({ rawArgs: '1' });
        await clearCommand.execute(second);
        expect(second.reply).toHaveBeenCalledWith('<:loading:loading-id> Já estou limpando este canal. Espere eu terminar para começar outra limpeza.');
        expect(second.textChannel!.fetchMessages).not.toHaveBeenCalled();
        const other = mockContext({ rawArgs: '1', channelId: 'other-channel' });
        await clearCommand.execute(other);
        expect(other.textChannel!.fetchMessages).toHaveBeenCalledOnce();
      } finally {
        release();
        await first;
      }
    });

    it('releases lock on error', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => {
          throw new Error('Network error');
        }),
      });
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 10 }],
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:ops:ops-id> Não consegui buscar as mensagens. Tente de novo daqui a pouco.');

      const port2 = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => []),
      });
      const ctx2 = mockContext({
        textChannel: port2,
        options: [{ name: 'quantidade', value: 5 }],
      });
      await clearCommand.execute(ctx2);
      expect(ctx2.reply).toHaveBeenCalledWith('<:search:search-id> Não encontrei mensagens para apagar. Só consigo limpar mensagens enviadas há menos de 14 dias.');
    });

    it('calls acknowledge before any work', async () => {
      const ctx = mockContext();
      await clearCommand.execute(ctx);
      expect(ctx.acknowledge).toHaveBeenCalledOnce();
      const acknowledgeOrder = (ctx.acknowledge as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      const replyOrder = (ctx.reply as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      expect(acknowledgeOrder).toBeDefined();
      expect(replyOrder).toBeDefined();
      expect(acknowledgeOrder!).toBeLessThan(replyOrder!);
    });

    it('filters messages older than 14 days', async () => {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-new-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
          { id: 'msg-new-2', createdTimestamp: Date.now() - 2000, author: { id: 'user-2' } },
          { id: 'msg-old', createdTimestamp: twoWeeksAgo - 1000, author: { id: 'user-1' } },
        ]),
      });
      port.bulkDelete = vi.fn(async () => 2);
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 10 }],
      });
      await clearCommand.execute(ctx);
      expect(port.bulkDelete).toHaveBeenCalledOnce();
      expect(port.bulkDelete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'msg-new-1' }),
          expect.objectContaining({ id: 'msg-new-2' }),
        ]),
      );
      const deletedIds = (port.bulkDelete as ReturnType<typeof vi.fn>).mock.calls[0]![0]!.map((m: { id: string }) => m.id);
      expect(deletedIds).not.toContain('msg-old');
    });

    it('sends only public confirmation after deletion', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
        ]),
        bulkDelete: vi.fn(async () => 1),
      });
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const deleteReply = vi.fn().mockResolvedValue(undefined);
      const ctx = mockContext({
        textChannel: port,
        sendMessage,
        deleteReply,
        options: [{ name: 'quantidade', value: 1 }],
      });
      await clearCommand.execute(ctx);
      expect(sendMessage).toHaveBeenCalledWith('<:cleaning:cleaning-id> Pronto. Apaguei 1 mensagem em <#channel-123>. <:slap:slap-id>');
      expect(deleteReply).toHaveBeenCalledOnce();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('does not expose error details in failure message', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => {
          throw new Error('secret internal detail');
        }),
      });
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 10 }],
      });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:ops:ops-id> Não consegui buscar as mensagens. Tente de novo daqui a pouco.');
      const replyArg = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
      expect(replyArg).not.toContain('secret internal detail');
    });

    it('does not crash when reply fails after fetch error (message deleted)', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => {
          throw new Error('Network error');
        }),
      });
      const reply = vi.fn()
        .mockRejectedValueOnce(new Error('Unknown Message'))
        .mockResolvedValue(undefined);
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 10 }],
        reply,
      });
      await expect(clearCommand.execute(ctx)).resolves.toBeUndefined();
    });

    it('reports delete failure separately from fetch', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
          { id: 'msg-2', createdTimestamp: Date.now() - 2000, author: { id: 'user-2' } },
        ]),
        bulkDelete: vi.fn(async () => { throw new Error('Discord API Error'); }),
      });
      const ctx = mockContext({
        textChannel: port,
        options: [{ name: 'quantidade', value: 2 }],
      });
      await clearCommand.execute(ctx);
      expect(port.bulkDelete).toHaveBeenCalledOnce();
      expect(ctx.reply).toHaveBeenCalledWith('<:ops:ops-id> Não consegui concluir a limpeza. Confira o histórico antes de tentar de novo.');
      expect(ctx.sendMessage).not.toHaveBeenCalled();
    });

    it('sends no second confirmation when the public confirmation fails', async () => {
      const port = mockBulkDeletePort({
        fetchMessages: vi.fn(async () => [
          { id: 'msg-1', createdTimestamp: Date.now() - 1000, author: { id: 'user-1' } },
        ]),
        bulkDelete: vi.fn(async () => 1),
      });
      const sendMessage = vi.fn().mockRejectedValue(new Error('Channel not found'));
      const reply = vi.fn().mockResolvedValue(undefined);
      const deleteReply = vi.fn().mockResolvedValue(undefined);
      const ctx = mockContext({
        textChannel: port,
        sendMessage,
        reply,
        deleteReply,
        options: [{ name: 'quantidade', value: 1 }],
      });
      await clearCommand.execute(ctx);
      // Deletion already succeeded: only the ephemeral indicator is discarded, with no extra reply.
      expect(sendMessage).toHaveBeenCalledOnce();
      expect(reply).not.toHaveBeenCalled();
      expect(deleteReply).toHaveBeenCalledOnce();
    });

    it.each(['50 invalid', '50 <@123>', '50 123456789012345678 extra'])('rejects an invalid prefix filter: %s', async (rawArgs) => {
      const ctx = mockContext({ rawArgs });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledOnce();
      expect(ctx.textChannel!.fetchMessages).not.toHaveBeenCalled();
      expect(ctx.textChannel!.bulkDelete).not.toHaveBeenCalled();
    });

    it.each(['', null, 123])('rejects malformed slash user filters: %s', async (value) => {
      const ctx = mockContext({ options: [{ name: 'quantidade', value: 1 }, { name: 'usuario', value }] });
      await clearCommand.execute(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('<:ID:ID-id> Não consegui identificar esse usuário. Selecione um usuário válido para a limpeza.');
      expect(ctx.textChannel!.fetchMessages).not.toHaveBeenCalled();
    });
  });
});
