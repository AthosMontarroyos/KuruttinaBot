import { CommandContext } from '../types/command-context';
import { EMOJIS, STATUS_COLORS } from '@kuruttina/shared';
import { APIEmbed, PermissionFlagsBits } from 'discord.js';

export class PermissionGuard {
  /**
   * Garante que o comando seja executado estritamente por Desenvolvedores / Criador da Kuruttina.
   */
  public static async enforceDevOnly(ctx: CommandContext): Promise<boolean> {
    const devGuildId = process.env.DEV_GUILD_ID;
    const creatorId = process.env.CREATOR_ACCOUNT_ID;
    const devId = process.env.DEV_ACCOUNT_ID;

    // 1. Dev Guild restriction
    if (!ctx.guild || (devGuildId && ctx.guild.id !== devGuildId)) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Acesso Negado`,
        description: 'Este comando é restrito ao servidor de desenvolvimento oficial da Kuruttina.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return false;
    }

    // 2. Creator or Dev account restriction
    const userId = ctx.user.id;
    const isAuthorized = (creatorId && userId === creatorId) || (devId && userId === devId);

    if (!isAuthorized) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Permissão Insuficiente`,
        description: 'Apenas os desenvolvedores autorizados ou o criador da Kuruttina podem executar este comando.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return false;
    }

    return true;
  }

  /**
   * Garante que o usuário possua permissões administrativas na guilda.
   */
  public static async enforceAdminOnly(ctx: CommandContext): Promise<boolean> {
    if (!ctx.guild) return false;

    if (ctx.isSlash && ctx.slashInteraction) {
      const memberPermissions = ctx.slashInteraction.memberPermissions;
      if (!memberPermissions || !memberPermissions.has(PermissionFlagsBits.Administrator)) {
        const errorEmbed: APIEmbed = {
          title: `${EMOJIS.ERROR} Permissão Requerida`,
          description: 'Você precisa da permissão de **Administrador** no servidor para executar este comando.',
          color: STATUS_COLORS.ERROR.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return false;
      }
    }

    return true;
  }
}
