import { MessageFlags, type ButtonInteraction, type InteractionReplyOptions } from 'discord.js';
import type { CatalogCommand } from '@kuruttina/command-catalog';
import { buildHelpPage } from '#bot/command-system/helpReply.js';
import { withEmojis } from '#bot/command-system/responses.js';
import { createEmojiResolver } from '#bot/infrastructure/discord/commands/commandContext.js';
import { log } from '#bot/infrastructure/logging/logger.js';

const failureMessage = 'Não consegui trocar a página da ajuda. Use **/help** de novo.';

/**
 * Clique em seta do `/help`: só quem abriu a ajuda troca de página. A página
 * atual é editada no próprio clique (`update`), sem mensagem nova.
 */
export async function handleHelpButton(
  interaction: ButtonInteraction,
  target: { page: number; ownerId: string },
  catalog: readonly CatalogCommand[],
): Promise<void> {
  const emoji = createEmojiResolver(interaction.client.application);
  try {
    if (interaction.user.id !== target.ownerId) {
      await interaction.reply({
        content: withEmojis(await emoji('Disappointed'), 'Só quem abriu esta ajuda pode navegar por ela. Use **/help** para abrir a sua.'),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const book = await emoji('book');
    const reply = buildHelpPage(catalog, target.page, target.ownerId, { book });
    await interaction.update({
      ...(typeof reply === 'string' ? { content: reply } : reply),
      allowedMentions: { parse: [] },
    });
  } catch (error: unknown) {
    log('error', 'help_navigation_failed', {
      interactionId: interaction.id,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    try {
      const options: InteractionReplyOptions = {
        content: withEmojis(await emoji('error'), failureMessage),
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) await interaction.followUp(options);
      else await interaction.reply(options);
    } catch (responseError: unknown) {
      log('error', 'help_navigation_failed', {
        interactionId: interaction.id,
        errorName: responseError instanceof Error ? responseError.name : 'UnknownError',
      });
    }
  }
}
