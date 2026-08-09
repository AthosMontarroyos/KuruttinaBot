import { CommandContext } from '../types/command-context';
import { STATUS_COLORS } from '@kuruttina/shared';
import { APIEmbed, PermissionFlagsBits } from 'discord.js';
import { getEmoji } from './emoji-resolver';

export class PermissionGuard {
  /**
   * Garante que o comando seja executado estritamente por Desenvolvedores / Criador da Kuruttina.
   */
  public static async enforceDevOnly(ctx: CommandContext): Promise<boolean> {
    const devGuildId = process.env.DEV_GUILD_ID;
    const creatorId = process.env.CREATOR_ACCOUNT_ID;
    const devId = process.env.DEV_ACCOUNT_ID;

    const angerEmoji = await getEmoji(ctx.client, 'ANGER');

    // 1. Dev Guild restriction
    if (!ctx.guild || (devGuildId && ctx.guild.id !== devGuildId)) {
      const errorEmbed: APIEmbed = {
        title: `${angerEmoji} Acesso Negado`,
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
        title: `${angerEmoji} Permissão Insuficiente`,
        description: 'Apenas os desenvolvedores autorizados ou o criador da Kuruttina podem executar este comando.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return false;
    }

    return true;
  }

  /**
   * Garante que o usuário possua a permissão especificada na guilda.
   */
  public static async enforcePermission(
    ctx: CommandContext,
    permissionBit: bigint,
    permissionLabel: string
  ): Promise<boolean> {
    const errorEmoji = await getEmoji(ctx.client, 'DISMISS');

    if (!ctx.guild) {
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Comando Restrito`,
        description: 'Este comando só pode ser executado dentro de um servidor.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return false;
    }

    let hasPerm = false;

    if (ctx.isSlash && ctx.slashInteraction) {
      hasPerm = Boolean(ctx.slashInteraction.memberPermissions?.has(permissionBit));
    } else if (ctx.message && ctx.message.member) {
      hasPerm = ctx.message.member.permissions.has(permissionBit);
    }

    if (!hasPerm) {
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Permissão Requerida`,
        description: `Você precisa da permissão de **${permissionLabel}** no servidor para executar este comando.`,
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
    return this.enforcePermission(ctx, PermissionFlagsBits.Administrator, 'Administrador');
  }

  /**
   * Garante que o usuário possua permissão de Gerenciar Mensagens na guilda.
   */
  public static async enforceManageMessages(ctx: CommandContext): Promise<boolean> {
    return this.enforcePermission(ctx, PermissionFlagsBits.ManageMessages, 'Gerenciar Mensagens');
  }
}
