import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  APIEmbed,
  User,
} from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG, CooldownManager } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmoji } from '../../../../utils/emoji-resolver';

// 10-second cooldown per user to prevent API flooding
const clearCooldowns = new CooldownManager(10);

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Apaga até 200 mensagens em lote do canal atual (Requer Gerenciar Mensagens)')
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription('Número de mensagens a serem apagadas (1 a 200)')
        .setMinValue(1)
        .setMaxValue(200)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Filtrar limpeza e apagar apenas mensagens deste usuário específico')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  prefixAliases: ['clear', 'limpar', 'purge', 'clean'],
  category: 'moderation',
  subCategory: 'actions',
  guide: {
    syntax: 'k!clear <quantidade> [usuario] ou /clear <quantidade> [usuario]',
    examples: ['/clear quantidade:50', '/clear quantidade:20 usuario:@Membro', 'k!clear 10', 'k!limpar 100'],
    detailedDescription:
      'Apaga mensagens em massa do canal de texto atual. Permite apagar até 200 mensagens por execução e filtrar mensagens de um usuário específico. Respeita a limitação da API do Discord (mensagens com mais de 14 dias não podem ser apagadas em lote).',
    requiredPermissions: ['ManageMessages'],
  },

  async execute(ctx: CommandContext): Promise<void> {
    // 1. Authorization Guard (User must have Manage Messages permission)
    if (!ctx.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      const errorEmoji = await getEmoji(ctx.client, 'ERROR');
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Permissão Insuficiente`,
        description: 'Você precisa da permissão de **Gerenciar Mensagens** para utilizar este comando.',
        color: EMBED_COLORS.BLACK.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // 2. Cooldown Guard (10s)
    const cooldownLeft = clearCooldowns.check(ctx.user.id);
    if (cooldownLeft > 0) {
      const warningEmoji = await getEmoji(ctx.client, 'WARNING');
      const errorEmbed: APIEmbed = {
        title: `${warningEmoji} Aguarde um momento`,
        description: `Aguarde \`${cooldownLeft}s\` para usar o comando de limpeza novamente.`,
        color: EMBED_COLORS.BLACK.number,
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
      const errorEmoji = await getEmoji(ctx.client, 'ERROR');
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Canal Inválido`,
        description: 'Este comando só pode ser executado em canais de texto do servidor.',
        color: EMBED_COLORS.BLACK.number,
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
      const errorEmoji = await getEmoji(ctx.client, 'ERROR');
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Permissão do Bot Ausente`,
        description:
          'Eu preciso das permissões de **Gerenciar Mensagens** e **Ver Histórico de Mensagens** neste canal para executar a limpeza.',
        color: EMBED_COLORS.BLACK.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // 5. Parse Options (Quantity & Target User)
    let amountToClear = 0;
    let targetUser: User | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      amountToClear = ctx.slashInteraction.options.getInteger('quantidade', true);
      targetUser = ctx.slashInteraction.options.getUser('usuario');
    } else {
      // Prefix Command Parsing: k!clear <amount> [@user|userID]
      const rawAmount = parseInt(ctx.args[0], 10);
      if (isNaN(rawAmount) || rawAmount < 1 || rawAmount > 200) {
        const warningEmoji = await getEmoji(ctx.client, 'WARNING');
        const errorEmbed: APIEmbed = {
          title: `${warningEmoji} Quantidade Inválida`,
          description:
            'Por favor, informe uma quantidade válida de mensagens entre **1** e **200**.\n\n*Exemplo:* `k!clear 50`',
          color: EMBED_COLORS.BLACK.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }
      amountToClear = rawAmount;

      if (ctx.args[1]) {
        const userMentionMatch = ctx.args[1].match(/^<@!?(\d+)>$/);
        const userId = userMentionMatch ? userMentionMatch[1] : ctx.args[1];
        try {
          targetUser = await ctx.client.users.fetch(userId);
        } catch {
          // User not found, ignore filter
        }
      }
    }

    // Apply Cooldown after passing validation
    clearCooldowns.apply(ctx.user.id);

    // Acknowledge interaction (3-second rule)
    await ctx.deferReply(true);

    try {
      let totalDeleted = 0;
      let skippedOldMessages = false;

      // 6. Batch Processing (Discord API limits bulkDelete to max 100 messages per call)
      const batches = amountToClear > 100 ? [100, amountToClear - 100] : [amountToClear];

      for (const batchSize of batches) {
        let fetchedMessages = await channel.messages.fetch({ limit: batchSize });

        // Filter by user if target specified
        if (targetUser) {
          fetchedMessages = fetchedMessages.filter((msg) => msg.author.id === targetUser!.id);
        }

        if (fetchedMessages.size === 0) continue;

        // Perform bulk deletion (filterOld = true automatically ignores messages > 14 days)
        const deletedBatch = await channel.bulkDelete(fetchedMessages, true);
        totalDeleted += deletedBatch.size;

        if (deletedBatch.size < fetchedMessages.size) {
          skippedOldMessages = true;
        }

        // Small pause between batches to prevent REST rate-limits
        if (batches.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Resolve live Developer Portal emojis
      const cleaningEmoji = await getEmoji(ctx.client, 'CLEANING');
      const successEmoji = await getEmoji(ctx.client, 'SUCCESS');

      const filterNotice = targetUser ? ` do usuário **${targetUser.tag}**` : '';

      const fields = [
        {
          name: '🧹 Mensagens Solicitadas',
          value: `\`${amountToClear}\``,
          inline: true,
        },
        {
          name: '✅ Apagadas com Sucesso',
          value: `\`${totalDeleted}\``,
          inline: true,
        },
      ];

      if (skippedOldMessages) {
        fields.push({
          name: '🕒 Trava de 14 Dias',
          value: 'Algumas mensagens com mais de 14 dias não puderam ser apagadas e foram ignoradas automaticamente.',
          inline: false,
        });
      }

      const successEmbed: APIEmbed = {
        title: `${cleaningEmoji} Limpeza Concluída`,
        description: `${successEmoji} Foram apagadas **${totalDeleted}** mensagem(ns)${filterNotice} no canal <#${channel.id}>.`,
        color: EMBED_COLORS.BLACK.number,
        fields,
        footer: {
          text: DEFAULT_BOT_CONFIG.BOT_NAME,
          icon_url: ctx.client.user?.displayAvatarURL(),
        },
        timestamp: new Date().toISOString(),
      };

      await ctx.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error: any) {
      console.error('❌ [Clear Command Error]:', error);

      const errorEmoji = await getEmoji(ctx.client, 'ERROR');
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Falha na Limpeza`,
        description: `Ocorreu um erro ao tentar apagar as mensagens: \`${
          error.message || error
        }\``,
        color: EMBED_COLORS.BLACK.number,
      };

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
