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
} from '../../../../utils';

// 5-second cooldown per user
const timeoutCooldowns = new CooldownManager(5);

// Max 28 days in seconds (Discord API limit)
const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60; // 2,419,200s

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Aplica um castigo (silenciamento) a um membro do servidor')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('Membro a silenciar por menção (@membro) ou ID numérico')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('tempo')
        .setDescription('Duração do castigo (ex: 10m, 1h, 7d, máx: 28d)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo do castigo')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  prefixAliases: ['timeout', 'castigar', 'mute', 'silenciar', 'castigo'],
  category: 'moderation',
  subCategory: 'actions',
  guide: {
    syntax: 'k!timeout <usuario> <tempo> [motivo] ou /timeout <usuario> <tempo> [motivo]',
    examples: [
      '/timeout usuario:@Membro tempo:1h motivo:Spam excessivo',
      'k!timeout @Membro 28d Violou regras do servidor',
      'k!castigar 1234567890 30m',
    ],
    detailedDescription:
      'Aplica um castigo temporário (silenciamento/timeout) de até 28 dias a um membro do servidor.',
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
        'Eu preciso da permissão de **Gerenciar Castigos (Moderate Members)** no servidor para castigar membros.'
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
        `Você não pode aplicar um castigo a si mesmo ${e.FACEPALM}`
      );
      return;
    }

    if (targetUser.id === ctx.client.user?.id) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Ação Inválida`,
        'Você não pode me aplicar um castigo usando o meu próprio comando.'
      );
      return;
    }

    if (targetUser.id === ctx.guild.ownerId) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Operação Proibida`,
        'Você não pode aplicar um castigo ao dono do servidor.'
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
          'Você não pode castigar um membro com cargo igual ou superior ao seu.'
        );
        return;
      }
    }

    // Bot Role Hierarchy Check
    if (botMember.roles.highest.position <= targetMember.roles.highest.position || !targetMember.moderatable) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Impossível Castigar`,
        'Não posso castigar este membro pois o cargo dele é igual ou superior ao meu.'
      );
      return;
    }

    // 7. Parse Duration & Reason
    let durationStr: string | null = null;
    let reason: string | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      durationStr = ctx.slashInteraction.options.getString('tempo');
      reason = ctx.slashInteraction.options.getString('motivo');
    } else {
      // Prefix argument parsing: k!timeout @user <tempo> [motivo] OR k!timeout @user [motivo] <tempo>
      const extraArgs = ctx.args.slice(1);
      if (extraArgs.length > 0) {
        // Try first argument after target
        const firstParsed = parseTimeString(extraArgs[0], {
          maxSeconds: MAX_TIMEOUT_SECONDS,
          minSeconds: 1,
          defaultUnit: 'm',
        });

        if (firstParsed) {
          durationStr = extraArgs[0];
          reason = extraArgs.slice(1).join(' ').trim() || null;
        } else {
          // Try last argument
          const lastArg = extraArgs[extraArgs.length - 1];
          const lastParsed = parseTimeString(lastArg, {
            maxSeconds: MAX_TIMEOUT_SECONDS,
            minSeconds: 1,
            defaultUnit: 'm',
          });

          if (lastParsed) {
            durationStr = lastArg;
            reason = extraArgs.slice(0, extraArgs.length - 1).join(' ').trim() || null;
          }
        }
      }
    }

    if (!durationStr) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Duração Ausente`,
        'Você precisa informar a duração do castigo (ex: `10m`, `1h`, `7d`, máx: `28d`).'
      );
      return;
    }

    const parsedTime = parseTimeString(durationStr, {
      maxSeconds: MAX_TIMEOUT_SECONDS,
      minSeconds: 1,
      defaultUnit: 'm',
    });

    if (!parsedTime) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Duração Inválida`,
        'Informe uma duração válida entre 1 segundo e **28 dias** (ex: `10m`, `1h`, `7d`, `28d`).'
      );
      return;
    }

    // 8. Cooldown Guard (5s)
    const cooldownLeft = timeoutCooldowns.check(ctx.user.id);
    if (cooldownLeft > 0) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Aguarde um momento`,
        `Aguarde \`${cooldownLeft}s\` para usar o comando de castigo novamente.`
      );
      return;
    }

    // 9. Execute Timeout
    try {
      const auditReason = reason || 'Nenhum motivo especificado.';
      // Subtract 60 seconds safety margin if reaching max 28 days to prevent clock drift API rejection
      const safeDurationMs = Math.min(
        parsedTime.milliseconds,
        (MAX_TIMEOUT_SECONDS - 60) * 1000
      );

      await targetMember.timeout(
        safeDurationMs,
        `[Kuruttina Moderação] ${auditReason} (Por: ${ctx.user.tag})`
      );

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
        {
          name: `${e.WAIT || e.LOADING} Duração`,
          value: `\`${parsedTime.humanReadable}\` (\`${parsedTime.formatted}\`)`,
          inline: false,
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
        title: `${e.MUTE} Castigo Aplicado`,
        description: `${e.SUCCESS} O membro **${targetUser.tag}** foi silenciado por **${parsedTime.humanReadable}**.`,
        fields,
      });

      await ctx.reply({ embeds: [successEmbed] });
    } catch (error: any) {
      console.error('❌ [Timeout Command Error]:', error);
      await sendErrorReply(
        ctx,
        `${e.ERROR} Falha no Castigo`,
        `Ocorreu um erro ao tentar aplicar o castigo: \`${error.message || error}\``
      );
    }
  },
};
