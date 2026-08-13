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
const unbanCooldowns = new CooldownManager(5);

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Desbane um usuário do servidor')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('ID numérico ou menção do usuário a desbanir')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo do desbanimento')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  prefixAliases: ['unban', 'desbanir', 'unbanir'],
  category: 'moderation',
  subCategory: 'actions',
  guide: {
    syntax: 'k!unban <usuario> [motivo] ou /unban <usuario> [motivo]',
    examples: [
      '/unban usuario:1234567890 motivo:Recurso aceito',
      'k!unban 1234567890 Engano',
      'k!desbanir 1234567890',
    ],
    detailedDescription:
      'Remove o banimento de um usuário do servidor utilizando o ID numérico ou menção do usuário.',
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
        'Eu preciso da permissão de **Banir Membros** no servidor para desbanir usuários.'
      );
      return;
    }

    // 4. Resolve Target User
    const targetUser = await resolveUser(ctx);
    if (!targetUser) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Usuário Não Encontrado`,
        'Não foi possível encontrar o usuário informado. Forneça um ID numérico ou menção válida.'
      );
      return;
    }

    // 5. Verify if User is Banned
    const banInfo = await ctx.guild.bans.fetch(targetUser.id).catch(() => null);
    if (!banInfo) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Usuário Não Banido`,
        `O usuário **${targetUser.tag}** (\`${targetUser.id}\`) não está na lista de banidos deste servidor.`
      );
      return;
    }

    // 6. Cooldown Guard (5s)
    const cooldownLeft = unbanCooldowns.check(ctx.user.id);
    if (cooldownLeft > 0) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Aguarde um momento`,
        `Aguarde \`${cooldownLeft}s\` para usar o comando de desbanimento novamente.`
      );
      return;
    }

    // 7. Extract Reason
    let reason: string | null = null;
    if (ctx.isSlash && ctx.slashInteraction) {
      reason = ctx.slashInteraction.options.getString('motivo');
    } else if (ctx.args.length > 1) {
      reason = ctx.args.slice(1).join(' ').trim() || null;
    }

    unbanCooldowns.apply(ctx.user.id);

    // 8. Execute Unban
    try {
      const auditReason = reason || 'Nenhum motivo especificado.';
      await ctx.guild.bans.remove(
        targetUser.id,
        `[Kuruttina Moderação] ${auditReason} (Por: ${ctx.user.tag})`
      );

      const reasonSuffix = reason ? ` | Motivo: \`${reason}\`` : '';
      await ctx.reply({
        content: `${e.UNBAN} O usuário ${targetUser} foi desbanido do servidor por ${ctx.user}.${reasonSuffix}`,
      });
    } catch (error: any) {
      console.error('❌ [Unban Command Error]:', error);
      await sendErrorReply(
        ctx,
        `${e.ERROR} Falha no Desbanimento`,
        `Ocorreu um erro ao tentar desbanir o usuário: \`${error.message || error}\``
      );
    }
  },
};
