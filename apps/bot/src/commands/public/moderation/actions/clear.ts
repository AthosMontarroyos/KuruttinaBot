import {
  SlashCommandBuilder,
  APIEmbed,
  PermissionFlagsBits,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  Collection,
  Message,
} from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG, EMOJIS } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { PermissionGuard } from '../../../../utils/permission-guard';
import { CooldownManager } from '../../../../utils/cooldown-manager';

/**
 * Extrai o ID numérico do usuário aceitando menção (<@ID> / <@!ID>) ou ID bruto (123456789012345678).
 */
function extractUserId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/^<@!?(\d+)>$/) || trimmed.match(/^(\d{17,20})$/);
  return match ? match[1] : null;
}

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa até 200 mensagens no canal com filtro opcional por usuário')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription('Número de mensagens para apagar (1 a 200)')
        .setMinValue(1)
        .setMaxValue(200)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Filtrar e apagar mensagens apenas deste usuário')
        .setRequired(false)
    ),
  prefixAliases: ['clear', 'limpar', 'purge', 'clean'],
  category: 'moderation',
  subCategory: 'actions',
  guide: {
    syntax: 'k!clear <1-200> [@usuario|ID]',
    examples: [
      '/clear quantidade:50',
      '/clear quantidade:100 usuario:@DevKurutta',
      'k!clear 100',
      'k!limpar 50 123456789012345678',
    ],
    detailedDescription:
      'Limpa mensagens em massa no canal atual (máximo 200 mensagens). Aceita menção <@usuario> ou ID numérico direto na mesma opção, ignorando mensagens mais antigas que 14 dias para evitar falhas.',
    requiredPermissions: ['ManageMessages'],
  },

  async execute(ctx: CommandContext): Promise<void> {
    // 1. Enforce Server-Side Permission Guard (ManageMessages)
    const hasPerm = await PermissionGuard.enforceManageMessages(ctx);
    if (!hasPerm) return;

    // 2. Enforce Rate Limit / Cooldown (5 seconds)
    const cooldownLeft = CooldownManager.checkCooldown('clear', ctx.user.id, 5);
    if (cooldownLeft > 0) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.WARNING} Aguarde um momento`,
        description: `Aguarde \`${cooldownLeft}s\` para usar o comando de limpeza novamente.`,
        color: STATUS_COLORS.WARNING.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // 3. Verify Channel Type (TextChannel, NewsChannel, ThreadChannel)
    const channel = ctx.channel;
    if (
      !channel ||
      !(
        channel instanceof TextChannel ||
        channel instanceof NewsChannel ||
        channel instanceof ThreadChannel
      )
    ) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Canal Inválido`,
        description: 'Este comando só pode ser executado em canais de texto do servidor.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // 4. Verify Bot Permissions (ManageMessages + ReadMessageHistory)
    const botMember = ctx.guild?.members.me;
    if (
      !botMember ||
      !channel.permissionsFor(botMember).has([
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ])
    ) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Permissão do Bot Ausente`,
        description:
          'Eu preciso das permissões de **Gerenciar Mensagens** e **Ver Histórico de Mensagens** neste canal para executar a limpeza.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Parse options
    let amount = 0;
    let targetUserId: string | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      amount = ctx.slashInteraction.options.getInteger('quantidade', true);
      const userObj = ctx.slashInteraction.options.getUser('usuario');
      targetUserId = userObj ? userObj.id : null;
    } else {
      amount = parseInt(ctx.args[0], 10);
      if (isNaN(amount) || amount < 1 || amount > 200) {
        const errorEmbed: APIEmbed = {
          title: `${EMOJIS.WARNING} Quantidade Inválida`,
          description: 'Uso correto: `k!clear <1-200> [@usuario|ID]`. Escolha um número entre 1 e 200.',
          color: STATUS_COLORS.WARNING.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      if (ctx.message && ctx.message.mentions.users.size > 0) {
        targetUserId = ctx.message.mentions.users.first()!.id;
      } else if (ctx.args[1]) {
        targetUserId = extractUserId(ctx.args[1]);
      }
    }

    // Defer response ephemerally (3-second rule)
    await ctx.deferReply(true);

    try {
      let totalDeleted = 0;
      let lastMessageId: string | undefined = !ctx.isSlash && ctx.message ? ctx.message.id : undefined;
      const targetAmount = amount;

      // Smart Fetch & Delete Engine (Searches history for target user's messages up to targetAmount)
      while (totalDeleted < targetAmount) {
        const needed = targetAmount - totalDeleted;
        // Fetch up to 100 messages at a time to scan for user messages
        const fetchLimit = targetUserId ? 100 : Math.min(needed, 100);

        const fetchOptions: { limit: number; before?: string } = { limit: fetchLimit };
        if (lastMessageId) {
          fetchOptions.before = lastMessageId;
        }

        const fetchedMessages = await channel.messages.fetch(fetchOptions);
        if (fetchedMessages.size === 0) break;

        lastMessageId = fetchedMessages.last()?.id;

        // Filter messages belonging to target user if specified
        let messagesToDelete: Collection<string, Message> = targetUserId
          ? fetchedMessages.filter((m) => m.author.id === targetUserId)
          : fetchedMessages;

        // Exclude original trigger message if prefix command to avoid double deletion
        if (!ctx.isSlash && ctx.message) {
          messagesToDelete = messagesToDelete.filter((m) => m.id !== ctx.message!.id);
        }

        if (messagesToDelete.size === 0) {
          if (fetchedMessages.size < fetchLimit) break;
          continue;
        }

        // Limit deletion batch to exact remaining needed amount
        if (messagesToDelete.size > needed) {
          const slicedCollection = new Collection<string, Message>();
          let count = 0;
          for (const [id, msg] of messagesToDelete.entries()) {
            if (count >= needed) break;
            slicedCollection.set(id, msg);
            count++;
          }
          messagesToDelete = slicedCollection;
        }

        // CRITICAL ANTI-CRASH GUARANTEE: Pass filterOld = true to prevent DiscordAPIError[50034]
        const deletedBatch = await channel.bulkDelete(messagesToDelete, true);
        totalDeleted += deletedBatch.size;

        // Stop if no messages deleted (remaining messages are >14 days old) or end of channel reached
        if (deletedBatch.size === 0 || fetchedMessages.size < fetchLimit) {
          break;
        }
      }

      // Render success response
      const filterNotice = targetUserId ? ` do usuário <@${targetUserId}>` : '';
      const fields = [
        {
          name: '📊 Solicitadas',
          value: `\`${amount}\``,
          inline: true,
        },
        {
          name: '🗑️ Deletadas',
          value: `\`${totalDeleted}\``,
          inline: true,
        },
        {
          name: '🕒 Trava de 14 Dias',
          value: 'Mensagens com mais de 14 dias foram ignoradas automaticamente.',
          inline: false,
        },
      ];

      if (!ctx.isSlash) {
        fields.push({
          name: '🎁 Bônus de Limpeza',
          value: 'A mensagem do comando por prefixo foi limpa automaticamente como bônus (sem descontar das solicitadas).',
          inline: false,
        });
      }

      const successEmbed: APIEmbed = {
        title: `${EMOJIS.SUCCESS} Limpeza Concluída`,
        description: `Foram apagadas **${totalDeleted}** mensagem(ns)${filterNotice} no canal <#${channel.id}>.`,
        color: STATUS_COLORS.SUCCESS.number,
        fields,
        footer: {
          text: DEFAULT_BOT_CONFIG.BOT_NAME,
          icon_url: ctx.client.user?.displayAvatarURL(),
        },
        timestamp: new Date().toISOString(),
      };

      // Send output response first
      await ctx.reply({ embeds: [successEmbed], ephemeral: true });

      // AFTER responding, clean up prefix command trigger message safely
      if (!ctx.isSlash && ctx.message && ctx.message.deletable) {
        ctx.message.delete().catch(() => {});
      }
    } catch (error: any) {
      console.error('❌ [Clear Command Error]:', error);

      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Falha na Limpeza`,
        description: `Ocorreu um erro ao tentar apagar as mensagens: \`${
          error.message || error
        }\``,
        color: STATUS_COLORS.ERROR.number,
      };

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
