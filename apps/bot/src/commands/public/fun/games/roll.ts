import { SlashCommandBuilder } from 'discord.js';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { KuruttinaClient } from '../../../../types/kuruttina-client';
import { getEmojis } from '../../../../utils/emoji-resolver';
import { createKuruttinaEmbed } from '../../../../utils/embed-builder';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Gira dados de sorte no formato NdX (ex: 1d20, 2d6, 3d10)')
    .addStringOption((option) =>
      option
        .setName('expressao')
        .setDescription('Expressão no formato NdX (ex: 2d20, 1d6, 3d10)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('dados')
        .setDescription('Quantidade de giros/dados (1 a 20)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('lados')
        .setDescription('Número de lados do dado (1 a 1000)')
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(false)
    ),
  prefixAliases: ['roll', 'dado', 'd', '1d20', '2d20', '1d6', '2d6', 'd20', 'd6'],
  category: 'fun',
  subCategory: 'games',
  guide: {
    syntax: 'k!1d20 ou k!2d6 ou /roll [expressao]',
    examples: ['k!1d20', 'k!2d6', '/roll expressao:2d20', '/roll dados:2 lados:20'],
    detailedDescription:
      'Gira um ou múltiplos dados com N lados (ex: k!1d20, k!2d6). Exibe o resultado de cada dado, a soma total e destaques de acerto/falha crítica!',
  },

  async execute(ctx: CommandContext): Promise<void> {
    const client = ctx.client as KuruttinaClient;

    let numDice = 1;
    let numSides = 20;
    let rawExpression = '1d20';

    // Parse input from Slash Command or Prefix Trigger
    if (ctx.isSlash && ctx.slashInteraction) {
      const exprOpt = ctx.slashInteraction.options.getString('expressao');
      const diceOpt = ctx.slashInteraction.options.getInteger('dados');
      const sidesOpt = ctx.slashInteraction.options.getInteger('lados');

      if (exprOpt) {
        rawExpression = exprOpt.trim().toLowerCase();
        const match = rawExpression.match(/^(\d+)?d(\d+)$/i);
        if (match) {
          numDice = match[1] ? parseInt(match[1], 10) : 1;
          numSides = parseInt(match[2], 10);
        }
      } else {
        if (diceOpt) numDice = diceOpt;
        if (sidesOpt) numSides = sidesOpt;
        rawExpression = `${numDice}d${numSides}`;
      }
    } else {
      // Prefix Command parsing: e.g. k!1d20, k!2d6, k!roll 3d10
      const firstArg = ctx.args[0]?.trim().toLowerCase();
      let inputStr = firstArg;

      // Check if command name itself is a dice expression (e.g. k!1d20 or k!d20)
      const commandTrigger = ctx.message?.content.slice((process.env.DEFAULT_PREFIX || 'k!').length).trim().split(/ +/)[0].toLowerCase();

      if (commandTrigger && /^(\d+)?d(\d+)$/i.test(commandTrigger)) {
        inputStr = commandTrigger;
      }

      if (inputStr && /^(\d+)?d(\d+)$/i.test(inputStr)) {
        rawExpression = inputStr;
        const match = inputStr.match(/^(\d+)?d(\d+)$/i);
        if (match) {
          numDice = match[1] ? parseInt(match[1], 10) : 1;
          numSides = parseInt(match[2], 10);
        }
      } else if (ctx.args[0] && ctx.args[1]) {
        // Alternative syntax: k!roll 2 20
        const d = parseInt(ctx.args[0], 10);
        const s = parseInt(ctx.args[1], 10);
        if (!isNaN(d) && !isNaN(s)) {
          numDice = d;
          numSides = s;
          rawExpression = `${numDice}d${numSides}`;
        }
      }
    }

    // Enforce limits for safety & anti-spam
    if (numDice < 1) numDice = 1;
    if (numDice > 20) numDice = 20;
    if (numSides < 1) numSides = 1;
    if (numSides > 1000) numSides = 1000;

    // Perform Dice Rolls
    const rolls: number[] = [];
    let totalSum = 0;
    let hasNat20 = false;
    let hasNat1 = false;

    for (let i = 0; i < numDice; i++) {
      const rollValue = Math.floor(Math.random() * numSides) + 1;
      rolls.push(rollValue);
      totalSum += rollValue;

      if (numSides === 20 && rollValue === 20) hasNat20 = true;
      if (numSides === 20 && rollValue === 1) hasNat1 = true;
    }

    // Batch resolve Application Emojis concurrently
    const { DICE_ROLL, DICE_ANIMATED, DICE, STAR, WARNING, STATS } = await getEmojis(client, [
      'DICE_ROLL', 'DICE_ANIMATED', 'DICE', 'STAR', 'WARNING', 'STATS',
    ]);

    // INFJ Persona Wittiness & Commentary
    let commentary = `${DICE_ANIMATED} A sorte foi lançada sobre a mesa!`;
    if (hasNat20) {
      commentary = `${STAR} **Vinte Natural!** Um resultado extraordinário guiado pela mais pura intuição!`;
    } else if (hasNat1) {
      commentary = `${WARNING} **Falha Crítica (1)...** A sabedoria também habita nos pequenos percalços do destino.`;
    }

    // Format individual rolls list
    const formattedRolls = rolls
      .map((val, idx) => {
        let highlight = `\`${val}\``;
        if (numSides === 20 && val === 20) highlight = `**\`20\`** ${STAR} (Crítico!)`;
        if (numSides === 20 && val === 1) highlight = `**\`1\`** (Falha Crítica!)`;
        return `${DICE} Giro ${idx + 1}: ${highlight}`;
      })
      .join('\n');

    // Build Embed using factory
    const resultEmbed = createKuruttinaEmbed(client, {
      title: `${DICE_ROLL} Lançamento de Dados: ${numDice}d${numSides}`,
      description: commentary,
      fields: [
        {
          name: `${DICE} Resultados Individuais`,
          value: formattedRolls || 'Nenhum resultado.',
          inline: false,
        },
        {
          name: `${STATS} Soma Total`,
          value: `\`${totalSum}\``,
          inline: true,
        },
        {
          name: `${STATS} Média`,
          value: `\`${(totalSum / numDice).toFixed(1)}\``,
          inline: true,
        },
      ],
      footerText: `Giros: ${numDice} | Lados: ${numSides}`,
    });

    await ctx.reply({ embeds: [resultEmbed] });
  },
};

