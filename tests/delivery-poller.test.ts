import { describe, expect, it, vi } from 'vitest';
import type { MessageTemplate } from '@kuruttina/message-templates';
import {
  createDeliveryPoller,
  type DeliveryDatabasePort,
} from '../apps/bot/src/infrastructure/discord/messages/deliveryPoller.js';
import { toCommandReply } from '../apps/bot/src/infrastructure/discord/messages/toCommandReply.js';

vi.mock('../apps/bot/src/infrastructure/discord/messages/toCommandReply.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../apps/bot/src/infrastructure/discord/messages/toCommandReply.js')>();
  return { ...actual, toCommandReply: vi.fn(actual.toCommandReply) };
});

const simpleTemplate: MessageTemplate = { content: 'Olá!', embeds: [], components: [] };

function makeDatabase(overrides: Partial<DeliveryDatabasePort> = {}): DeliveryDatabasePort {
  return {
    deliveries: {
      claimPending: vi.fn().mockResolvedValue([]),
      markSent: vi.fn().mockResolvedValue(true),
      markFailed: vi.fn().mockResolvedValue(true),
    },
    templates: {
      getTemplate: vi.fn().mockResolvedValue({ content: simpleTemplate }),
    },
    ...overrides,
  } as DeliveryDatabasePort;
}

function makeClient(channel: unknown) {
  return {
    channels: { fetch: vi.fn().mockResolvedValue(channel) },
  } as never;
}

function textChannel(guildId: string, send: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined)) {
  return { isTextBased: () => true, guildId, send };
}

async function runOneTick(client: never, database: DeliveryDatabasePort, expectedSettled: number): Promise<void> {
  const poller = createDeliveryPoller(client, database, 1000000);
  // O primeiro ciclo roda imediatamente; espera a cadeia assíncrona inteira
  // (canal, template, envio e marcação) terminar antes de inspecionar os mocks.
  await vi.waitFor(() => {
    const settled = vi.mocked(database.deliveries.markSent).mock.calls.length
      + vi.mocked(database.deliveries.markFailed).mock.calls.length;
    expect(settled).toBeGreaterThanOrEqual(expectedSettled);
  });
  poller.stop();
}

describe('delivery poller', () => {
  it('sends the rendered template and marks the delivery as sent', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = textChannel('guild-1', send);
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 1, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome' },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });
    const client = makeClient(channel);

    await runOneTick(client, database, 1);

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ content: 'Olá!' }));
    expect(database.deliveries.markSent).toHaveBeenCalledExactlyOnceWith(1);
    expect(database.deliveries.markFailed).not.toHaveBeenCalled();
  });

  it('fails with channel_not_found when the channel fetch returns null', async () => {
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 2, guildId: 'guild-1', channelId: 'channel-missing', templateName: 'welcome' },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });
    const client = makeClient(null);

    await runOneTick(client, database, 1);

    expect(database.deliveries.markFailed).toHaveBeenCalledExactlyOnceWith(2, 'channel_not_found');
  });

  it('fails with wrong_guild when the channel belongs to another server', async () => {
    const channel = textChannel('guild-other');
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 3, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome' },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });
    const client = makeClient(channel);

    await runOneTick(client, database, 1);

    expect(database.deliveries.markFailed).toHaveBeenCalledExactlyOnceWith(3, 'wrong_guild');
  });

  it('fails with template_not_found when the template no longer exists', async () => {
    const channel = textChannel('guild-1');
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 4, guildId: 'guild-1', channelId: 'channel-1', templateName: 'gone' },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
      templates: { getTemplate: vi.fn().mockResolvedValue(null) },
    });
    const client = makeClient(channel);

    await runOneTick(client, database, 1);

    expect(database.deliveries.markFailed).toHaveBeenCalledExactlyOnceWith(4, 'template_not_found');
  });

  it('fails with send_failed when sending raises an unknown error', async () => {
    const send = vi.fn().mockRejectedValue(new Error('network error'));
    const channel = textChannel('guild-1', send);
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 5, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome' },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });
    const client = makeClient(channel);

    await runOneTick(client, database, 1);

    expect(database.deliveries.markFailed).toHaveBeenCalledExactlyOnceWith(5, 'send_failed');
  });

  it('keeps processing the remaining items of the cycle when one item fails', async () => {
    const sendOk = vi.fn().mockResolvedValue(undefined);
    const channelOk = textChannel('guild-1', sendOk);
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 6, guildId: 'guild-1', channelId: 'channel-missing', templateName: 'welcome' },
          { id: 7, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome' },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });
    const client = {
      channels: {
        fetch: vi.fn((channelId: string) => Promise.resolve(channelId === 'channel-1' ? channelOk : null)),
      },
    } as never;

    await runOneTick(client, database, 2);

    expect(database.deliveries.markFailed).toHaveBeenCalledExactlyOnceWith(6, 'channel_not_found');
    expect(database.deliveries.markSent).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('fails with render_failed when the template cannot be converted', async () => {
    vi.mocked(toCommandReply).mockImplementationOnce(() => {
      throw new Error('componente desconhecido');
    });
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = textChannel('guild-1', send);
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 8, guildId: 'guild-1', channelId: 'channel-1', templateName: 'broken' },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });
    const client = makeClient(channel);

    await runOneTick(client, database, 1);

    expect(send).not.toHaveBeenCalled();
    expect(database.deliveries.markFailed).toHaveBeenCalledExactlyOnceWith(8, 'render_failed');
    expect(database.deliveries.markSent).not.toHaveBeenCalled();
  });
});
