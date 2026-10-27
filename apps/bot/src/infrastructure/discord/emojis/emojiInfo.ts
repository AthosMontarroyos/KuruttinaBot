import { ButtonStyle, ComponentType, type APIActionRowComponent, type APIButtonComponent } from 'discord.js';
import { withEmojis } from '#bot/command-system/responses.js';
import type { CommandContext, CommandReply, EmojiInfoLookup } from '#bot/command-system/types.js';

const CUSTOM_EMOJI = /^<a?:([A-Za-z0-9_]{2,32}):(\d{17,20})>$/u;
const EMOJI_CDN = 'https://cdn.discordapp.com/emojis';

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
  const [base, identity, mention] = await Promise.all([
    context.render('emojiinfo.info', { id: markup.id }),
    context.emoji('ID'),
    context.emoji('photo'),
  ]);
  const embed = typeof base === 'string' ? undefined : base.embeds[0];
  // Ícones, miniatura, campo da menção (o motor escaparia o `_` da marcação) e botão com URL dinâmica ficam aqui.
  return {
    embeds: [{
      ...embed,
      thumbnail: { url },
      fields: [
        ...(embed?.fields ?? []).map((field) => ({ ...field, name: withEmojis(identity, field.name) })),
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
      await context.reply(await context.render('emojiinfo.usage', {}));
      return;
    }
    const lookupPort = context.emojiInfo;
    if (lookupPort === undefined || context.guildId === undefined) {
      await context.reply(await context.render('emojiinfo.not_available', {}));
      return;
    }
    const lookup = await lookupPort.lookup(context.guildId, markup.id);
    if (lookup.status === 'unavailable') {
      await context.reply(await context.render('emojiinfo.unavailable', {}));
      return;
    }
    await context.reply(await infoReply(context, markup, lookup));
  };
}
