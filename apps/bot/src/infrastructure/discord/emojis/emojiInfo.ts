import { ButtonStyle, ComponentType, type APIActionRowComponent, type APIButtonComponent } from 'discord.js';
import { withEmojis } from '#bot/command-system/responses.js';
import type { CommandContext, CommandReply, EmojiInfoLookup } from '#bot/command-system/types.js';

const CUSTOM_EMOJI = /^<a?:([A-Za-z0-9_]{2,32}):(\d{17,20})>$/u;
const EMOJI_CDN = 'https://cdn.discordapp.com/emojis';

const usageMessage = 'Envie somente a marcação de um emoji personalizado, como `<:nome:id>` ou `<a:nome:id>`.';
const unavailableMessage = 'Não consegui consultar este emoji agora. Tente de novo daqui a pouco.';
const notAvailableMessage = 'Não consigo consultar emojis agora. Tente de novo daqui a pouco.';

interface ParsedMarkup {
  readonly raw: string;
  readonly name: string;
  readonly id: string;
  readonly animated: boolean;
}

function parseMarkup(value: string): ParsedMarkup | undefined {
  const match = CUSTOM_EMOJI.exec(value);
  const name = match?.[1];
  const id = match?.[2];
  if (name === undefined || id === undefined) return undefined;
  return { raw: value, name, id, animated: value.startsWith('<a:') };
}

function readMarkup(context: CommandContext): ParsedMarkup | undefined {
  if ((context.attachments ?? []).length > 0) return undefined;
  if (context.options !== undefined) {
    const option = context.options.find((candidate) => candidate.name === 'emoji');
    if (typeof option?.value !== 'string') return undefined;
    return parseMarkup(option.value.trim());
  }
  const tokens = (context.rawArgs ?? '').trim().split(/\s+/u).filter((token) => token !== '');
  if (tokens.length !== 1) return undefined;
  const [token] = tokens;
  return token === undefined ? undefined : parseMarkup(token);
}

function imageUrl(id: string, animated: boolean): string {
  return `${EMOJI_CDN}/${id}.${animated ? 'gif' : 'png'}`;
}

async function replyWithEmoji(context: CommandContext, emojiName: string, text: string): Promise<void> {
  await context.reply(withEmojis(await context.emoji(emojiName), text));
}

function browserLink(url: string): APIActionRowComponent<APIButtonComponent> {
  return {
    type: ComponentType.ActionRow,
    components: [{
      type: ComponentType.Button,
      style: ButtonStyle.Link,
      label: 'Abrir no navegador',
      url,
    }],
  };
}

async function infoReply(context: CommandContext, markup: ParsedMarkup, lookup: EmojiInfoLookup): Promise<CommandReply> {
  const animated = lookup.status === 'confirmed' && lookup.animated !== null ? lookup.animated : markup.animated;
  const url = imageUrl(markup.id, animated);
  const [identity, mention] = await Promise.all([context.emoji('ID'), context.emoji('photo')]);
  return {
    embeds: [{
      color: 0x2b2d31,
      thumbnail: { url },
      fields: [
        { name: withEmojis(identity, 'Identidade'), value: `\`${markup.id}\``, inline: true },
        { name: withEmojis(mention, 'Menção'), value: `\`\`\`\n${markup.raw}\n\`\`\``, inline: true },
      ],
    }],
    components: [browserLink(url)],
  };
}

/**
 * Executor compartilhado de `/emoji info` e `k!emoji-info`.
 * Slash e prefixo só diferem na leitura da marcação.
 */
export function createEmojiInfoExecutor(): (context: CommandContext) => Promise<void> {
  return async (context) => {
    await context.acknowledge();
    const markup = readMarkup(context);
    if (markup === undefined) {
      await replyWithEmoji(context, 'warning', usageMessage);
      return;
    }
    const lookupPort = context.emojiInfo;
    if (lookupPort === undefined || context.guildId === undefined) {
      await replyWithEmoji(context, 'ops', notAvailableMessage);
      return;
    }
    const lookup = await lookupPort.lookup(context.guildId, markup.id);
    if (lookup.status === 'unavailable') {
      await replyWithEmoji(context, 'ops', unavailableMessage);
      return;
    }
    await context.reply(await infoReply(context, markup, lookup));
  };
}
