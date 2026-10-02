import type { Client } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { EmojiInfoLookup } from '../apps/bot/src/command-system/types.js';
import { createEmojiInfoExecutor } from '../apps/bot/src/infrastructure/discord/emojis/emojiInfo.js';
import { createEmojiLookup } from '../apps/bot/src/infrastructure/discord/emojis/emojiLookup.js';

const CURRENT = '910000000000000005';
const ORIGIN = '910000000000000006';
const EMOJI_ID = '90071992547409921';

type Outcome = { readonly name: string; readonly animated: boolean } | 'unknown' | 'down';

function fakeClient(outcomes: Readonly<Record<string, Outcome>>, cachedGuildId?: string) {
  const guildFetches: string[] = [];
  const emojiFetches: Array<{ guildId: string; emojiId: string; force: boolean }> = [];
  const cacheGet = vi.fn(() => (cachedGuildId === undefined ? undefined : { guild: { id: cachedGuildId } }));
  const client = {
    guilds: {
      fetch: async (guildId: string) => {
        guildFetches.push(guildId);
        return {
          name: guildId === ORIGIN ? 'Origem' : 'Atual',
          emojis: {
            fetch: async (emojiId: string, options: { force: true }) => {
              emojiFetches.push({ guildId, emojiId, force: options.force });
              const outcome = outcomes[guildId] ?? 'unknown';
              if (outcome === 'unknown') throw { code: 10014 };
              if (outcome === 'down') throw new Error('ECONNRESET private detail');
              return { id: emojiId, name: outcome.name, animated: outcome.animated };
            },
          },
        };
      },
    },
    emojis: { cache: { get: cacheGet } },
  };
  return { client: client as unknown as Client, guildFetches, emojiFetches, cacheGet };
}

describe('emoji lookup', () => {
  it('confirms the emoji in the current guild by REST and keeps the snowflake as text', async () => {
    const discord = fakeClient({ [CURRENT]: { name: 'wave', animated: false } });
    const result = await createEmojiLookup(discord.client).lookup(CURRENT, EMOJI_ID);

    expect(result).toEqual({ status: 'confirmed', name: 'wave', animated: false, guildName: 'Atual' });
    expect(discord.guildFetches).toEqual([CURRENT]);
    expect(discord.emojiFetches).toEqual([{ guildId: CURRENT, emojiId: EMOJI_ID, force: true }]);
    expect(discord.cacheGet).not.toHaveBeenCalled();
  });

  it('uses a cached guild only as a hint and confirms that guild by REST', async () => {
    const discord = fakeClient(
      { [CURRENT]: 'unknown', [ORIGIN]: { name: 'festa', animated: true } },
      ORIGIN,
    );
    const result = await createEmojiLookup(discord.client).lookup(CURRENT, EMOJI_ID);

    expect(result).toEqual({ status: 'confirmed', name: 'festa', animated: true, guildName: 'Origem' });
    expect(discord.guildFetches).toEqual([CURRENT, ORIGIN]);
    expect(discord.emojiFetches.map((call) => call.force)).toEqual([true, true]);
    expect(discord.cacheGet).toHaveBeenCalledExactlyOnceWith(EMOJI_ID);
  });

  it('does not treat a stale cache entry for the current guild as confirmation', async () => {
    const discord = fakeClient({ [CURRENT]: 'unknown' }, CURRENT);
    await expect(createEmojiLookup(discord.client).lookup(CURRENT, EMOJI_ID)).resolves.toEqual({ status: 'unconfirmed' });
    expect(discord.guildFetches).toEqual([CURRENT]);
  });

  it('reports an unknown origin without calling the absence a deletion', async () => {
    const discord = fakeClient({ [CURRENT]: 'unknown', [ORIGIN]: 'unknown' }, ORIGIN);
    await expect(createEmojiLookup(discord.client).lookup(CURRENT, EMOJI_ID)).resolves.toEqual({ status: 'unconfirmed' });
    expect(discord.guildFetches).toEqual([CURRENT, ORIGIN]);
  });

  it('does not search the cache when the current guild lookup fails', async () => {
    const discord = fakeClient({ [CURRENT]: 'down' }, ORIGIN);
    const result = await createEmojiLookup(discord.client).lookup(CURRENT, EMOJI_ID);
    expect(result).toEqual({ status: 'unavailable' });
    expect(JSON.stringify(result)).not.toContain('ECONNRESET');
    expect(discord.cacheGet).not.toHaveBeenCalled();
    expect(discord.guildFetches).toEqual([CURRENT]);
  });

  it('reports an origin lookup failure instead of guessing from the cache', async () => {
    const discord = fakeClient({ [CURRENT]: 'unknown', [ORIGIN]: 'down' }, ORIGIN);
    await expect(createEmojiLookup(discord.client).lookup(CURRENT, EMOJI_ID)).resolves.toEqual({ status: 'unavailable' });
    expect(discord.guildFetches).toEqual([CURRENT, ORIGIN]);
  });

  it('leaves the origin unidentified when the emoji is not cached', async () => {
    const discord = fakeClient({ [CURRENT]: 'unknown' });
    await expect(createEmojiLookup(discord.client).lookup(CURRENT, EMOJI_ID)).resolves.toEqual({ status: 'unconfirmed' });
    expect(discord.cacheGet).toHaveBeenCalledOnce();
    expect(discord.guildFetches).toEqual([CURRENT]);
  });
});

describe('emoji info executor', () => {
  const markup = `<:wave:${EMOJI_ID}>`;

  async function execute(context: {
    readonly options?: ReadonlyArray<{ readonly name: string; readonly value?: unknown }>;
    readonly rawArgs?: string;
    readonly attachments?: readonly [];
    readonly guildId?: string;
    readonly emojiInfo?: { lookup: (guildId: string, emojiId: string) => Promise<EmojiInfoLookup> };
    readonly emoji?: (name: string) => Promise<string>;
  }) {
    const reply = vi.fn(async (_content: unknown) => undefined);
    const acknowledge = vi.fn(async () => undefined);
    await createEmojiInfoExecutor()({
      apiPing: 0,
      gatewayPing: 0,
      acknowledge,
      emoji: context.emoji ?? (async (name) => (
        name === 'photo' ? '🖼️' : name === 'ID' ? '🪪' : name === 'warning' ? '⚠️' : '😅'
      )),
      reply,
      ...context,
    });
    return { reply, acknowledge };
  }

  it('sends only the embed and does not enable mentions', async () => {
    const lookup = vi.fn(async () => ({
      status: 'confirmed' as const,
      name: 'wave',
      animated: false,
      guildName: 'Linha\n@everyone *dois*',
    }));
    const { reply, acknowledge } = await execute({
      guildId: CURRENT,
      options: [{ name: 'emoji', value: markup }],
      emojiInfo: { lookup },
    });
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith(CURRENT, EMOJI_ID);
    const payload = reply.mock.calls[0]?.[0] as { content?: string; embeds: Array<{ thumbnail?: { url: string }; fields: Array<{ value: string }> }>; components?: readonly { readonly components: readonly { readonly label?: string; readonly url?: string }[] }[]; allowedMentions?: unknown } | undefined;
    if (payload === undefined) throw new Error('expected a reply');
    expect(payload.content).toBeUndefined();
    expect(payload.allowedMentions).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('@everyone');
    expect(payload.embeds[0]?.thumbnail?.url).toBe(`https://cdn.discordapp.com/emojis/${EMOJI_ID}.png`);
    expect(payload.embeds[0]?.fields[1]?.value).toBe(`\`\`\`\n${markup}\n\`\`\``);
    expect(payload.components?.[0]?.components[0]).toMatchObject({
      label: 'Abrir no navegador',
      url: `https://cdn.discordapp.com/emojis/${EMOJI_ID}.png`,
    });
  });

  it('answers with ops when the lookup port or the guild is missing', async () => {
    const lookup = vi.fn();
    const missingPort = await execute({ guildId: CURRENT, rawArgs: markup });
    const missingGuild = await execute({ options: [{ name: 'emoji', value: markup }], emojiInfo: { lookup } });
    expect(missingPort.reply).toHaveBeenCalledExactlyOnceWith('😅 Não consigo consultar emojis agora. Tente de novo daqui a pouco.');
    expect(missingGuild.reply).toHaveBeenCalledExactlyOnceWith('😅 Não consigo consultar emojis agora. Tente de novo daqui a pouco.');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('reads one prefix token and one slash option the same way', async () => {
    const lookup = vi.fn(async () => ({ status: 'unconfirmed' as const }));
    const slash = await execute({ guildId: CURRENT, options: [{ name: 'emoji', value: markup }], emojiInfo: { lookup } });
    const prefix = await execute({ guildId: CURRENT, rawArgs: markup, emojiInfo: { lookup } });
    const slashEmbed = (slash.reply.mock.calls[0]?.[0] as { embeds: Array<{ thumbnail?: { url: string }; fields: Array<{ value: string }> }> } | undefined)?.embeds[0];
    const prefixEmbed = (prefix.reply.mock.calls[0]?.[0] as { embeds: Array<{ thumbnail?: { url: string }; fields: Array<{ value: string }> }> } | undefined)?.embeds[0];
    expect(slashEmbed).toEqual(prefixEmbed);
    expect(slashEmbed?.thumbnail?.url).toBe(`https://cdn.discordapp.com/emojis/${EMOJI_ID}.png`);
    expect(slashEmbed?.fields[1]?.value).toBe(`\`\`\`\n${markup}\n\`\`\``);
  });
});
