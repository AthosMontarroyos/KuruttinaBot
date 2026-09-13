import type { APIEmbed, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';

export type CommandReply = string | {
  content: string;
  embeds: APIEmbed[];
};

export interface CommandContext {
  readonly apiPing: number;
  readonly gatewayPing: number;
  acknowledge(): Promise<void>;
  emoji(name: string): Promise<string>;
  reply(content: CommandReply): Promise<void>;
}

export interface ChatInputCommand {
  readonly data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  execute(context: CommandContext): Promise<void>;
}

export type CommandPayload = RESTPostAPIApplicationCommandsJSONBody;
