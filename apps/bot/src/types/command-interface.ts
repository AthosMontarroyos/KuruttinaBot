import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { CommandContext } from './command-context';

export interface CommandModule {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  prefixAliases?: string[];
  category?: string;
  subCategory?: string;
  execute: (ctx: CommandContext) => Promise<void>;
}
