import type { RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';

export interface CommandContext {
  acknowledge(): Promise<void>;
  reply(content: string): Promise<void>;
}

export interface ChatInputCommand {
  readonly data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  execute(context: CommandContext): Promise<void>;
}

export type CommandPayload = RESTPostAPIApplicationCommandsJSONBody;
