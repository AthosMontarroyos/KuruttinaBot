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
const contentTemplate: MessageTemplate = { content: 'Oi {user.name}', embeds: [], components: [] };
const REQUESTER_ID = '222222222222222222';

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

function contentChannel(send: ReturnType<typeof vi.fn>, membersFetch: ReturnType<typeof vi.fn>) {
  return {
    ...textChannel('guild-1', send),
    guild: {
      id: 'guild-1',
      name: 'Casa',
      memberCount: 6,
      iconURL: () => null,
      bannerURL: () => null,
      members: { fetch: membersFetch },
    },
  };
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
  it('fills user and guild variables, using the bot as the user, including the image fields', async () => {
    const template: MessageTemplate = {
      content: 'Oi {user.name} em {guild.name} ({guild.membercount})',
      embeds: [{
        title: '{user.mention}',
        thumbnail: { url: '{user.avatar}' },
        image: { url: '{guild.banner}' },
        author: { name: 'a', iconUrl: '{guild.avatar}' },
        footer: { text: 'f', iconUrl: '{user.avatar}' },
      }],
      components: [],
    };
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = {
      ...textChannel('guild-1', send),
      guild: {
        id: '987654321098765432',
        name: 'Casa',
        memberCount: 6,
        iconURL: () => 'https://cdn.discordapp.com/icons/9/i.png?size=256',
        bannerURL: () => null,
      },
    };
    const botUser = {
      id: '123456789012345678',
      displayName: 'Kuruttina Dev',
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/b.png?size=256',
    };
    const client = { channels: { fetch: vi.fn().mockResolvedValue(channel) }, user: botUser } as never;
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 1, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome', content: null, requestedBy: REQUESTER_ID },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
      templates: { getTemplate: vi.fn().mockResolvedValue({ content: template }) },
    });

    await runOneTick(client, database, 1);

    const sent = send.mock.calls[0]?.[0];
    expect(sent.content).toBe('Oi Kuruttina Dev em Casa (6)');
    expect(sent.embeds[0]).toMatchObject({
      title: '<@123456789012345678>',
      thumbnail: { url: 'https://cdn.discordapp.com/avatars/1/b.png?size=256' },
      author: { name: 'a', icon_url: 'https://cdn.discordapp.com/icons/9/i.png?size=256' },
      footer: { text: 'f', icon_url: 'https://cdn.discordapp.com/avatars/1/b.png?size=256' },
    });
    expect(sent.embeds[0]).not.toHaveProperty('image');
  });

  it('sends the rendered template and marks the delivery as sent', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const channel = textChannel('guild-1', send);
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 1, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome', content: null, requestedBy: REQUESTER_ID },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });
    const client = makeClient(channel);

    await runOneTick(client, database, 1);

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ content: 'Olá!', allowedMentions: { parse: [] } }));
    expect(database.deliveries.markSent).toHaveBeenCalledExactlyOnceWith(1);
    expect(database.deliveries.markFailed).not.toHaveBeenCalled();
  });

  it('renders a delivery with content using the member who requested it', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const membersFetch = vi.fn().mockResolvedValue({
      user: {
        id: REQUESTER_ID,
        displayName: 'Ana',
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/2/a.png?size=256',
      },
    });
    const channel = contentChannel(send, membersFetch);
    const botUser = {
      id: '123456789012345678',
      displayName: 'Kuruttina Dev',
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/b.png?size=256',
    };
    const client = { channels: { fetch: vi.fn().mockResolvedValue(channel) }, user: botUser } as never;
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 9, guildId: 'guild-1', channelId: 'channel-1', templateName: null, content: contentTemplate, requestedBy: REQUESTER_ID },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });

    await runOneTick(client, database, 1);

    expect(membersFetch).toHaveBeenCalledExactlyOnceWith(REQUESTER_ID);
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      content: 'Oi Ana',
      allowedMentions: { parse: [], users: [REQUESTER_ID] },
    }));
    expect(database.templates.getTemplate).not.toHaveBeenCalled();
    expect(database.deliveries.markSent).toHaveBeenCalledExactlyOnceWith(9);
    expect(database.deliveries.markFailed).not.toHaveBeenCalled();
  });

  it('fails with requester_not_found when the requester is no longer in the server', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const membersFetch = vi.fn().mockRejectedValue(new Error('Unknown Member'));
    const channel = contentChannel(send, membersFetch);
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 10, guildId: 'guild-1', channelId: 'channel-1', templateName: null, content: contentTemplate, requestedBy: REQUESTER_ID },
        ]).mockResolvedValue([]),
        markSent: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
      },
    });
    const client = makeClient(channel);

    await runOneTick(client, database, 1);

    expect(send).not.toHaveBeenCalled();
    expect(database.deliveries.markFailed).toHaveBeenCalledExactlyOnceWith(10, 'requester_not_found');
    expect(database.deliveries.markSent).not.toHaveBeenCalled();
  });

  it('fails with channel_not_found when the channel fetch returns null', async () => {
    const database = makeDatabase({
      deliveries: {
        claimPending: vi.fn().mockResolvedValueOnce([
          { id: 2, guildId: 'guild-1', channelId: 'channel-missing', templateName: 'welcome', content: null, requestedBy: REQUESTER_ID },
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
          { id: 3, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome', content: null, requestedBy: REQUESTER_ID },
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
          { id: 4, guildId: 'guild-1', channelId: 'channel-1', templateName: 'gone', content: null, requestedBy: REQUESTER_ID },
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
          { id: 5, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome', content: null, requestedBy: REQUESTER_ID },
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
          { id: 6, guildId: 'guild-1', channelId: 'channel-missing', templateName: 'welcome', content: null, requestedBy: REQUESTER_ID },
          { id: 7, guildId: 'guild-1', channelId: 'channel-1', templateName: 'welcome', content: null, requestedBy: REQUESTER_ID },
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
          { id: 8, guildId: 'guild-1', channelId: 'channel-1', templateName: 'broken', content: null, requestedBy: REQUESTER_ID },
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
