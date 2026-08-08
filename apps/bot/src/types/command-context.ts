import {
  ChatInputCommandInteraction,
  Message,
  Client,
  Guild,
  User,
  TextBasedChannel,
  InteractionReplyOptions,
  MessageReplyOptions,
  MessagePayload,
  EmbedBuilder,
} from 'discord.js';

export interface CommandReplyOptions {
  content?: string;
  embeds?: EmbedBuilder[];
  ephemeral?: boolean;
}

export class CommandContext {
  public readonly client: Client;
  public readonly guild: Guild | null;
  public readonly user: User;
  public readonly channel: TextBasedChannel | null;
  public readonly isSlash: boolean;
  public readonly slashInteraction?: ChatInputCommandInteraction;
  public readonly message?: Message;
  public readonly args: string[];

  constructor(
    trigger: ChatInputCommandInteraction | Message,
    args: string[] = []
  ) {
    if (trigger instanceof ChatInputCommandInteraction) {
      this.isSlash = true;
      this.slashInteraction = trigger;
      this.client = trigger.client;
      this.guild = trigger.guild;
      this.user = trigger.user;
      this.channel = trigger.channel;
      this.args = args;
    } else {
      this.isSlash = false;
      this.message = trigger;
      this.client = trigger.client;
      this.guild = trigger.guild;
      this.user = trigger.author;
      this.channel = trigger.channel;
      this.args = args;
    }
  }

  /**
   * Defer reply for async operations exceeding 3 seconds.
   */
  public async deferReply(ephemeral = false): Promise<void> {
    if (this.isSlash && this.slashInteraction) {
      if (!this.slashInteraction.deferred && !this.slashInteraction.replied) {
        await this.slashInteraction.deferReply({ ephemeral });
      }
    } else if (this.message) {
      if ('sendTyping' in this.message.channel) {
        await this.message.channel.sendTyping();
      }
    }
  }

  /**
   * Unified reply method for both Slash and Prefix commands.
   */
  public async reply(options: CommandReplyOptions | string): Promise<void> {
    const payload = typeof options === 'string' ? { content: options } : options;

    if (this.isSlash && this.slashInteraction) {
      const interactionOptions: InteractionReplyOptions = {
        content: payload.content,
        embeds: payload.embeds,
        ephemeral: payload.ephemeral ?? false,
      };

      if (this.slashInteraction.deferred || this.slashInteraction.replied) {
        await this.slashInteraction.followUp(interactionOptions);
      } else {
        await this.slashInteraction.reply(interactionOptions);
      }
    } else if (this.message) {
      const messageOptions: MessageReplyOptions = {
        content: payload.content,
        embeds: payload.embeds,
      };

      await this.message.reply(messageOptions);
    }
  }
}
