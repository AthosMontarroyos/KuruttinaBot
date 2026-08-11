import { CommandContext } from '../../types/command-context';
import {
  CustomCommandPayload,
  customCommandPayloadSchema,
  sanitizeText,
  EMOJIS,
  STATUS_COLORS,
} from '@kuruttina/shared';
import { APIEmbed } from 'discord.js';

/**
 * Motor Estático de Execução de Comandos Customizados de Afiliados (100% Imune a eval/RCE).
 */
export async function executeCustomCommand(
  ctx: CommandContext,
  rawPayload: unknown
): Promise<void> {
  // 1. Validate payload schema with Zod (Pillar 2: Schema Validation)
  const parseResult = customCommandPayloadSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    console.error('❌ [Security Alert] Payload de comando customizado corrompido ou malicioso descartado.');
    const errorEmbed: APIEmbed = {
      title: `${EMOJIS.ERROR} Erro de Execução`,
      description: 'Estrutura deste comando personalizado é inválida.',
      color: STATUS_COLORS.ERROR.number,
    };
    await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const payload: CustomCommandPayload = parseResult.data;

  // 2. Safe variable replacements (Template Variables)
  const replacePlaceholders = (text?: string): string => {
    if (!text) return '';
    const clean = sanitizeText(text);
    return clean
      .replace(/\{user\}/gi, ctx.user.username)
      .replace(/\{mention\}/gi, `<@${ctx.user.id}>`)
      .replace(/\{guild\}/gi, ctx.guild?.name || 'Servidor')
      .replace(/\{ping\}/gi, `${Math.round(ctx.client.ws.ping)}ms`);
  };

  // 3. Render content or embed declaratively (Zero-Eval)
  if (payload.responseType === 'text' && payload.content) {
    const renderedText = replacePlaceholders(payload.content);
    await ctx.reply({
      content: renderedText,
      // Pillar: Protection against Ping Spam (allowedMentions: { parse: [] })
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (payload.responseType === 'embed' && payload.embedData) {
    const embed: APIEmbed = {
      title: replacePlaceholders(payload.embedData.title),
      description: replacePlaceholders(payload.embedData.description),
      color: payload.embedData.color || STATUS_COLORS.INFO.number,
      fields: payload.embedData.fields?.map((f) => ({
        name: replacePlaceholders(f.name),
        value: replacePlaceholders(f.value),
        inline: f.inline,
      })),
      timestamp: new Date().toISOString(),
    };

    await ctx.reply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }
}
