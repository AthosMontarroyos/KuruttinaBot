import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { CooldownManager } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import {
  getEmojis,
  createKuruttinaEmbed,
  sendErrorReply,
  resolveUser,
  parseTimeString,
  ParsedTimeResult,
} from '../../../../utils';

// 5-second cooldown per user
const banCooldowns = new CooldownManager(5);

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bane um usuário ou membro do servidor')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuário a banir por menção (@membro) ou ID numérico')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo do banimento')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('tempo_mensagem')
        .setDescription('Histórico de mensagens a apagar (ex: 28s, 28m, 28h, 7d - máx 7d)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  prefixAliases: ['ban', 'banir'],
  category: 'moderation',
  subCategory: 'actions',
  guide: {
    syntax: 'k!ban <usuario> [motivo] [tempo_msg] ou /ban <usuario> [motivo] [tempo_mensagem]',
    examples: [
      '/ban usuario:@Membro motivo:Raid tempo_mensagem:28h',
      'k!ban @Membro Divulgação indevida 7d',
      'k!ban 1234567890 7d Spam',
      'k!banir @Membro Spam 30m',
    ],
    detailedDescription:
      'Bane um usuário do servidor (esteja ele no servidor ou não via ID). Permite apagar histórico de mensagens especificando um tempo no início ou no fim do motivo (ex: 28s, 28m, 28h, 7d - máximo 7 dias).',
    requiredPermissions: ['BanMembers'],
  },

  async execute(ctx: CommandContext): Promise<void> {
    const e = await getEmojis(ctx.client);

    // 1. Authorization Guard (User must have Ban Members permission)
    if (!ctx.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão Insuficiente`,
        'Você precisa da permissão de **Banir Membros** para utilizar este comando.'
      );
      return;
    }

    // 2. Guild Guard
    if (!ctx.guild) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Comando Restrito`,
        'Este comando só pode ser utilizado dentro de um servidor.'
      );
      return;
    }

    // 3. Bot Permissions Guard (Fetch fresh bot member for accurate role hierarchy)
    const botMember = await ctx.guild.members.fetchMe().catch(() => ctx.guild?.members.me);
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão do Bot Ausente`,
        'Eu preciso da permissão de **Banir Membros** no servidor para executar esta ação.'
      );
      return;
    }

    // 4. Resolve Target User
    const targetUser = await resolveUser(ctx);
    if (!targetUser) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Usuário Não Encontrado`,
        'Não foi possível encontrar o usuário informado. Mencione um membro ou forneça um ID válido.'
      );
      return;
    }

    // 5. Fetch Target GuildMember (if currently in server)
    const targetMember = await ctx.guild.members.fetch(targetUser.id).catch(() => null);

    // 6. Hierarchy & Safety Guards
    if (targetUser.id === ctx.user.id) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Ação Inválida`,
        `Você não pode banir a si mesmo ${e.FACEPALM}`
      );
      return;
    }

    if (targetUser.id === ctx.client.user?.id) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Ação Inválida`,
        'Você não pode me banir usando o meu próprio comando.'
      );
      return;
    }

    if (targetUser.id === ctx.guild.ownerId) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Operação Proibida`,
        'Você não pode banir o dono do servidor.'
      );
      return;
    }

    if (targetMember) {
      // Executor Role Hierarchy Check (unless executor is guild owner)
      const executorMember = await ctx.guild.members.fetch(ctx.user.id).catch(() => null);
      if (ctx.user.id !== ctx.guild.ownerId) {
        if (executorMember && executorMember.roles.highest.position <= targetMember.roles.highest.position) {
          await sendErrorReply(
            ctx,
            `${e.ERROR} Hierarquia Insuficiente`,
            'Você não pode banir um membro com cargo igual ou superior ao seu.'
          );
          return;
        }
      }

      // Bot Role Hierarchy Check
      if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
        await sendErrorReply(
          ctx,
          `${e.ERROR} Impossível Banir`,
          'Não posso banir este membro pois o cargo dele é igual ou superior ao meu.'
        );
        return;
      }

      if (!targetMember.bannable) {
        await sendErrorReply(
          ctx,
          `${e.ERROR} Membro Protegido`,
          'Este membro não pode ser banido por possuir permissões administrativas ou de proteção no servidor.'
        );
        return;
      }
    }

    // 7. Cooldown Guard (5s)
    const cooldownLeft = banCooldowns.check(ctx.user.id);
    if (cooldownLeft > 0) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Aguarde um momento`,
        `Aguarde \`${cooldownLeft}s\` para usar o comando de banimento novamente.`
      );
      return;
    }

    // 8. Extract Reason & Message Deletion Time
    let messageDeleteTime: ParsedTimeResult | null = null;
    let reason: string | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      const rawTime = ctx.slashInteraction.options.getString('tempo_mensagem');
      if (rawTime) {
        messageDeleteTime = parseTimeString(rawTime, { maxSeconds: 7 * 86400, defaultUnit: 'd' });
        if (!messageDeleteTime) {
          await sendErrorReply(
            ctx,
            `${e.WARNING} Tempo Inválido`,
            'O tempo de exclusão de mensagens deve ser de no máximo **7 dias** (ex: `7`, `28s`, `28m`, `28h`, `7d`).'
          );
          return;
        }
      }
      reason = ctx.slashInteraction.options.getString('motivo');
    } else if (ctx.args.length > 1) {
      const firstArgParsed = parseTimeString(ctx.args[1], { maxSeconds: 7 * 86400, defaultUnit: 'd' });
      const lastArgIndex = ctx.args.length - 1;
      const lastArgParsed =
        lastArgIndex > 1
          ? parseTimeString(ctx.args[lastArgIndex], { maxSeconds: 7 * 86400, defaultUnit: 'd' })
          : null;

      if (firstArgParsed) {
        // Format: k!ban @user 7d Motivo do ban
        messageDeleteTime = firstArgParsed;
        reason = ctx.args.slice(2).join(' ').trim() || null;
      } else if (lastArgParsed) {
        // Format: k!ban @user Motivo do ban 7d
        messageDeleteTime = lastArgParsed;
        reason = ctx.args.slice(1, lastArgIndex).join(' ').trim() || null;
      } else {
        // Format: k!ban @user Motivo do ban
        reason = ctx.args.slice(1).join(' ').trim() || null;
      }
    }

    banCooldowns.apply(ctx.user.id);

    // 9. Execute Ban
    try {
      const auditReason = reason || 'Nenhum motivo especificado.';
      await ctx.guild.members.ban(targetUser.id, {
        reason: `[Kuruttina Moderação] ${auditReason} (Por: ${ctx.user.tag})`,
        deleteMessageSeconds: messageDeleteTime ? messageDeleteTime.seconds : 0,
      });

      const fields = [
        {
          name: `${e.USER} Usuário`,
          value: `${targetUser.tag} (\`${targetUser.id}\`)`,
          inline: true,
        },
        {
          name: `${e.SHIELD} Moderador`,
          value: `${ctx.user.tag} (\`${ctx.user.id}\`)`,
          inline: true,
        },
      ];

      if (reason) {
        fields.push({
          name: `${e.DOCUMENTATION} Motivo`,
          value: `\`${reason}\``,
          inline: false,
        });
      }

      if (messageDeleteTime && messageDeleteTime.seconds > 0) {
        fields.push({
          name: `${e.CLEAR} Mensagens Apagadas`,
          value: `\`${messageDeleteTime.humanReadable}\``,
          inline: true,
        });
      }

      const successEmbed = createKuruttinaEmbed(ctx.client, {
        title: `${e.BAN} Usuário Banido`,
        description: `${e.SUCCESS} O usuário **${targetUser.tag}** foi banido com sucesso do servidor.`,
        fields,
      });

      await ctx.reply({ embeds: [successEmbed] });
    } catch (error: any) {
      console.error('❌ [Ban Command Error]:', error);
      await sendErrorReply(
        ctx,
        `${e.ERROR} Falha no Banimento`,
        `Ocorreu um erro ao tentar banir o usuário: \`${error.message || error}\``
      );
    }
  },
};
