import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { CooldownManager } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmojis, createKuruttinaEmbed, sendErrorReply, resolveUser } from '../../../../utils';

// 5-second cooldown per user
const kickCooldowns = new CooldownManager(5);

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa um membro do servidor')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('Membro a expulsar por menção (@membro) ou ID numérico')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo da expulsão')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  prefixAliases: ['kick', 'expulsar'],
  category: 'moderation',
  subCategory: 'actions',
  guide: {
    syntax: 'k!kick <usuario> [motivo] ou /kick <usuario> [motivo]',
    examples: ['/kick usuario:@Membro motivo:Spam no chat', 'k!kick 1234567890 Violou as regras'],
    detailedDescription:
      'Expulsa um membro do servidor. Verifica hierarquia de cargos do autor e do bot antes da expulsão.',
    requiredPermissions: ['KickMembers'],
  },

  async execute(ctx: CommandContext): Promise<void> {
    const e = await getEmojis(ctx.client);

    // 1. Authorization Guard (User must have Kick Members permission)
    if (!ctx.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão Insuficiente`,
        'Você precisa da permissão de **Expulsar Membros** para utilizar este comando.'
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
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão do Bot Ausente`,
        'Eu preciso da permissão de **Expulsar Membros** no servidor para executar esta ação.'
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

    // 6. Hierarchy & Safety Guards
    if (targetUser.id === ctx.user.id) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Ação Inválida`,
        `Você não pode expulsar a si mesmo ${e.FACEPALM}`
      );
      return;
    }

    if (targetUser.id === ctx.client.user?.id) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Ação Inválida`,
        'Você não pode me expulsar usando o meu próprio comando.'
      );
      return;
    }

    if (targetUser.id === ctx.guild.ownerId) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Operação Proibida`,
        'Você não pode expulsar o dono do servidor.'
      );
      return;
    }

    // Executor Role Hierarchy Check (unless executor is guild owner)
    const executorMember = await ctx.guild.members.fetch(ctx.user.id).catch(() => null);
    if (ctx.user.id !== ctx.guild.ownerId) {
      if (executorMember && executorMember.roles.highest.position <= targetMember.roles.highest.position) {
        await sendErrorReply(
          ctx,
          `${e.ERROR} Hierarquia Insuficiente`,
          'Você não pode expulsar um membro com cargo igual ou superior ao seu.'
        );
        return;
      }
    }

    // Bot Role Hierarchy Check
    if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Impossível Expulsar`,
        'Não posso expulsar este membro pois o cargo dele é igual ou superior ao meu.'
      );
      return;
    }

    // 7. Cooldown Guard (5s)
    const cooldownLeft = kickCooldowns.check(ctx.user.id);
    if (cooldownLeft > 0) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Aguarde um momento`,
        `Aguarde \`${cooldownLeft}s\` para usar o comando de expulsão novamente.`
      );
      return;
    }

    // 8. Extract Reason
    let reason: string | null = null;
    if (ctx.isSlash && ctx.slashInteraction) {
      reason = ctx.slashInteraction.options.getString('motivo');
    } else if (ctx.args.length > 1) {
      reason = ctx.args.slice(1).join(' ').trim() || null;
    }

    kickCooldowns.apply(ctx.user.id);

    // 9. Execute Kick
    try {
      const auditReason = reason || 'Nenhum motivo especificado.';
      await targetMember.kick(`[Kuruttina Moderação] ${auditReason} (Por: ${ctx.user.tag})`);

      const fields = [
        {
          name: `${e.USER} Membro`,
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

      const successEmbed = createKuruttinaEmbed(ctx.client, {
        title: `${e.KICK} Membro Expulso`,
        description: `${e.SUCCESS} O membro **${targetUser.tag}** foi expulso com sucesso do servidor.`,
        fields,
      });

      await ctx.reply({ embeds: [successEmbed] });
    } catch (error: any) {
      console.error('❌ [Kick Command Error]:', error);
      await sendErrorReply(
        ctx,
        `${e.ERROR} Falha na Expulsão`,
        `Ocorreu um erro ao tentar expulsar o membro: \`${error.message || error}\``
      );
    }
  },
};
