import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  User,
} from 'discord.js';
import { CooldownManager } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmojis, createKuruttinaEmbed, sendErrorReply } from '../../../../utils';

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
    const e = await getEmojis(ctx.client);

    // 1. Authorization Guard (User must have Manage Messages permission)
    if (!ctx.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão Insuficiente`,
        'Você precisa da permissão de **Gerenciar Mensagens** para utilizar este comando.'
      );
      return;
    }

    // 2. Cooldown Guard (10s)
    const cooldownLeft = clearCooldowns.check(ctx.user.id);
    if (cooldownLeft > 0) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Aguarde um momento`,
        `Aguarde \`${cooldownLeft}s\` para usar o comando de limpeza novamente.`
      );
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
      await sendErrorReply(
        ctx,
        `${e.ERROR} Canal Inválido`,
        'Este comando só pode ser executado em canais de texto do servidor.'
      );
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
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão do Bot Ausente`,
        'Eu preciso das permissões de **Gerenciar Mensagens** e **Ver Histórico de Mensagens** neste canal para executar a limpeza.'
      );
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
        await sendErrorReply(
          ctx,
          `${e.WARNING} Quantidade Inválida`,
          'Por favor, informe uma quantidade válida de mensagens entre **1** e **200**.\n\n*Exemplo:* `k!clear 50`'
        );
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

    // 6. Execute Bulk Delete Operation
    try {
      await ctx.deferReply(true);

      const fetchedMessages = await channel.messages.fetch({ limit: amountToClear });

      // Filter by user if specified
      let messagesToDelete = fetchedMessages;
      if (targetUser) {
        messagesToDelete = fetchedMessages.filter((msg) => msg.author.id === targetUser!.id);
      }

      // Filter out messages older than 14 days (Discord API restriction)
      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const validMessages = messagesToDelete.filter(
        (msg) => msg.createdTimestamp > fourteenDaysAgo
      );
      const skippedOldMessages = messagesToDelete.size - validMessages.size;

      let totalDeleted = 0;

      if (validMessages.size > 0) {
        if (validMessages.size === 1) {
          const singleMsg = validMessages.first()!;
          await singleMsg.delete();
          totalDeleted = 1;
        } else {
          const deleted = await channel.bulkDelete(validMessages, true);
          totalDeleted = deleted.size;
        }
      }

      const filterNotice = targetUser ? ` do usuário ${targetUser}` : '';

      let responseContent = `${e.CLEAR} Foram apagadas **${totalDeleted}** mensagem(ns)${filterNotice} no canal <#${channel.id}>.`;
      if (skippedOldMessages > 0) {
        responseContent += `\n${e.WAIT} *Algumas mensagens com mais de 14 dias foram ignoradas.*`;
      }

      await ctx.reply({ content: responseContent, ephemeral: true });
    } catch (error: any) {
      console.error('❌ [Clear Command Error]:', error);

      await sendErrorReply(
        ctx,
        `${e.ERROR} Falha na Limpeza`,
        `Ocorreu um erro ao tentar apagar as mensagens: \`${error.message || error}\``
      );
    }
  },
};
