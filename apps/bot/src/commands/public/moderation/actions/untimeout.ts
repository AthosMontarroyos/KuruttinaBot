import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { CooldownManager } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import {
  getEmojis,
  createKuruttinaEmbed,
  sendErrorReply,
  resolveUser,
} from '../../../../utils';

// 5-second cooldown per user
const untimeoutCooldowns = new CooldownManager(5);

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove o castigo (silenciamento) de um membro do servidor')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('Membro a remover o castigo por menção (@membro) ou ID numérico')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo da remoção do castigo')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  prefixAliases: ['untimeout', 'descastigar', 'unmute', 'desilenciar'],
  category: 'moderation',
  subCategory: 'actions',
  guide: {
    syntax: 'k!untimeout <usuario> [motivo] ou /untimeout <usuario> [motivo]',
    examples: [
      '/untimeout usuario:@Membro motivo:Recurso aceito',
      'k!untimeout 1234567890 Engano',
      'k!descastigar @Membro',
    ],
    detailedDescription:
      'Remove o castigo temporário (silenciamento/timeout) de um membro do servidor.',
    requiredPermissions: ['ModerateMembers'],
  },

  async execute(ctx: CommandContext): Promise<void> {
    const e = await getEmojis(ctx.client);

    // 1. Authorization Guard (User must have Moderate Members permission)
    if (!ctx.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão Insuficiente`,
        'Você precisa da permissão de **Gerenciar Castigos (Moderate Members)** para utilizar este comando.'
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
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão do Bot Ausente`,
        'Eu preciso da permissão de **Gerenciar Castigos (Moderate Members)** no servidor para remover castigos.'
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

    // 5. Fetch Target GuildMember
    const targetMember = await ctx.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Membro Ausente`,
        'O usuário informado não se encontra neste servidor.'
      );
      return;
    }

    // 6. Verify if Member is Timed Out
    if (!targetMember.isCommunicationDisabled()) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Membro Sem Castigo`,
        `O membro **${targetUser.tag}** (\`${targetUser.id}\`) não possui um castigo ativo neste servidor.`
      );
      return;
    }

    if (targetUser.id === ctx.client.user?.id) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Ação Inválida`,
        `Você não pode remover o castigo de mim mesma ${e.ANGER}`
      );
      return;
    }

    // 7. Hierarchy & Safety Guards
    const executorMember = await ctx.guild.members.fetch(ctx.user.id).catch(() => null);
    if (ctx.user.id !== ctx.guild.ownerId) {
      if (executorMember && executorMember.roles.highest.position <= targetMember.roles.highest.position) {
        await sendErrorReply(
          ctx,
          `${e.ERROR} Hierarquia Insuficiente`,
          'Você não pode remover o castigo de um membro com cargo igual ou superior ao seu.'
        );
        return;
      }
    }

    if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Impossível Remover Castigo`,
        'Não posso remover o castigo deste membro pois o cargo dele é igual ou superior ao meu.'
      );
      return;
    }

    // 8. Cooldown Guard (5s)
    const cooldownLeft = untimeoutCooldowns.check(ctx.user.id);
    if (cooldownLeft > 0) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Aguarde um momento`,
        `Aguarde \`${cooldownLeft}s\` para usar o comando de remover castigo novamente.`
      );
      return;
    }

    // 9. Extract Reason
    let reason: string | null = null;
    if (ctx.isSlash && ctx.slashInteraction) {
      reason = ctx.slashInteraction.options.getString('motivo');
    } else if (ctx.args.length > 1) {
      reason = ctx.args.slice(1).join(' ').trim() || null;
    }

    untimeoutCooldowns.apply(ctx.user.id);

    // 10. Execute Untimeout (Set timeout to null)
    try {
      const auditReason = reason || 'Nenhum motivo especificado.';
      await targetMember.timeout(
        null,
        `[Kuruttina Moderação] ${auditReason} (Por: ${ctx.user.tag})`
      );

      const reasonSuffix = reason ? ` | Motivo: \`${reason}\`` : '';
      await ctx.reply({
        content: `${e.UNTIMEOUT} O castigo do membro ${targetUser} foi removido por ${ctx.user}.${reasonSuffix}`,
      });
    } catch (error: any) {
      console.error('❌ [Untimeout Command Error]:', error);
      await sendErrorReply(
        ctx,
        `${e.ERROR} Falha ao Remover Castigo`,
        `Ocorreu um erro ao tentar remover o castigo: \`${error.message || error}\``
      );
    }
  },
};
