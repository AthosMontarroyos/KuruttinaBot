import { Client, APIEmbed } from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../types/command-context';

export interface KuruttinaEmbedOptions {
  title?: string;
  description?: string;
  fields?: APIEmbed['fields'];
  color?: number;
  footerText?: string;
  image?: APIEmbed['image'];
  thumbnail?: APIEmbed['thumbnail'];
}

/**
 * Factory for creating standardized Kuruttina Discord APIEmbed objects.
 * Enforces Rule 16: Strictly Black/White borders, dynamic bot avatar, auto timestamp.
 */
export function createKuruttinaEmbed(
  client: Client,
  options: KuruttinaEmbedOptions = {}
): APIEmbed {
  const botAvatar = client.user?.displayAvatarURL();
  const footerText = options.footerText
    ? `${DEFAULT_BOT_CONFIG.BOT_NAME} • ${options.footerText}`
    : DEFAULT_BOT_CONFIG.BOT_NAME;

  return {
    title: options.title,
    description: options.description,
    color: options.color ?? EMBED_COLORS.BLACK.number,
    fields: options.fields,
    image: options.image,
    thumbnail: options.thumbnail,
    footer: {
      text: footerText,
      icon_url: botAvatar,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to send a standardized error reply embed.
 */
export async function sendErrorReply(
  ctx: CommandContext,
  title: string,
  description: string,
  ephemeral = true
): Promise<void> {
  const embed = createKuruttinaEmbed(ctx.client, {
    title,
    description,
    color: EMBED_COLORS.BLACK.number,
  });
  await ctx.reply({ embeds: [embed], ephemeral });
}

/**
 * Helper to send a standardized success reply embed.
 */
export async function sendSuccessReply(
  ctx: CommandContext,
  title: string,
  description: string,
  fields?: APIEmbed['fields'],
  ephemeral = false
): Promise<void> {
  const embed = createKuruttinaEmbed(ctx.client, {
    title,
    description,
    fields,
    color: EMBED_COLORS.BLACK.number,
  });
  await ctx.reply({ embeds: [embed], ephemeral });
}
