import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { CommandContext } from './command-context';

export interface CommandUsageGuide {
  syntax: string;
  examples: string[];
  detailedDescription?: string;
  requiredPermissions?: string[];
}

export interface CommandModule {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  prefixAliases?: string[];
  category: string;
  subCategory?: string;
  guide: CommandUsageGuide;
  execute: (ctx: CommandContext) => Promise<void>;
}
