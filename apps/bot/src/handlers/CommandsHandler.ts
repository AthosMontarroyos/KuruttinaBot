import type { ChatInputCommand, CommandContext, CommandPayload } from '#bot/commands/types.js';
import { validateCommandAccess } from '#bot/commands/access.js';

export class CommandsHandler {
  private readonly commandsByName = new Map<string, ChatInputCommand>();

  constructor(registeredCommands: readonly ChatInputCommand[]) {
    for (const command of registeredCommands) {
      if (this.commandsByName.has(command.data.name)) {
        throw new Error(`Duplicate chat input command: ${command.data.name}`);
      }

      this.commandsByName.set(command.data.name, command);
    }
  }

  payload(): CommandPayload[] {
    return [...this.commandsByName.values()].map((command) => command.data.toJSON());
  }

  has(commandName: string): boolean {
    return this.commandsByName.has(commandName);
  }

  async execute(commandName: string, context: CommandContext): Promise<void> {
    const command = this.commandsByName.get(commandName);

    if (!command) throw new Error(`Unknown command: ${commandName}`);

    // Central gate for both transports: acknowledge first so slash denials stay ephemeral.
    const accessError = await validateCommandAccess(command.access, context);
    if (accessError) {
      await context.acknowledge();
      await context.reply(accessError);
      return;
    }

    await command.execute(context);
  }
}
