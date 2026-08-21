import {
  ChatInputCommandInteraction,
  Message,
  TextBasedChannel,
  Guild,
  User,
  APIEmbed,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  MessageCreateOptions,
  MessageFlags,
  PermissionsBitField,
} from 'discord.js';

export interface ReplyPayload {
  content?: string;
  embeds?: APIEmbed[];
  components?: any[];
  files?: MessageCreateOptions['files'];
  ephemeral?: boolean;
  allowedMentions?: any;
}

export class CommandContext {
  public isSlash: boolean;
  public slashInteraction?: ChatInputCommandInteraction;
  public message?: Message;
  public channel: TextBasedChannel;
  public guild: Guild | null;
  public user: User;
  public args: string[];

  constructor(
    target:
      | ChatInputCommandInteraction
      | Message
      | {
          slashInteraction?: ChatInputCommandInteraction;
          message?: Message;
          args?: string[];
        },
    args: string[] = []
  ) {
    if (typeof target === 'object' && 'isChatInputCommand' in target && target.isChatInputCommand()) {
      this.isSlash = true;
      this.slashInteraction = target;
      this.channel = target.channel!;
      this.guild = target.guild;
      this.user = target.user;
      this.args = [];
    } else if (typeof target === 'object' && 'author' in target) {
      this.isSlash = false;
      this.message = target;
      this.channel = target.channel;
      this.guild = target.guild;
      this.user = target.author;
      this.args = args;
    } else if (typeof target === 'object' && 'slashInteraction' in target && target.slashInteraction) {
      this.isSlash = true;
      this.slashInteraction = target.slashInteraction;
      this.channel = target.slashInteraction.channel!;
      this.guild = target.slashInteraction.guild;
      this.user = target.slashInteraction.user;
      this.args = [];
    } else if (typeof target === 'object' && 'message' in target && target.message) {
      this.isSlash = false;
      this.message = target.message;
      this.channel = target.message.channel;
      this.guild = target.message.guild;
      this.user = target.message.author;
      this.args = target.args || args;
    } else {
      throw new Error('CommandContext requer um slashInteraction ou um message.');
    }
  }

  public get client() {
    return this.isSlash ? this.slashInteraction!.client : this.message!.client;
  }

  public get memberPermissions(): Readonly<PermissionsBitField> | null {
    if (this.isSlash && this.slashInteraction) {
      return this.slashInteraction.memberPermissions;
    } else if (this.message && this.message.member) {
      return this.message.member.permissions;
    }
    return null;
  }

  public async deferReply(ephemeral = false): Promise<void> {
    if (this.isSlash && this.slashInteraction && !this.slashInteraction.deferred) {
      await this.slashInteraction.deferReply({
        flags: ephemeral ? MessageFlags.Ephemeral : undefined,
      });
    }
  }

  public async reply(payload: ReplyPayload): Promise<Message | null> {
    // Default allowedMentions to prevent ping spams (Pillar 6)
    const defaultAllowedMentions = payload.allowedMentions || { parse: [] };

    if (this.isSlash && this.slashInteraction) {
      const interactionOptions: InteractionReplyOptions = {
        content: payload.content,
        embeds: payload.embeds,
        components: payload.components,
        files: payload.files,
        flags: payload.ephemeral ? MessageFlags.Ephemeral : undefined,
        allowedMentions: defaultAllowedMentions,
      };

      // A normal response after deferReply must edit the original response.
      // Otherwise followUp creates a second message and fetchReply() returns
      // the still-empty "thinking" response, breaking component collectors.
      if (this.slashInteraction.deferred) {
        const shouldKeepDeferredVisibility =
          payload.ephemeral === true && this.slashInteraction.ephemeral !== true;

        if (!shouldKeepDeferredVisibility) {
          const editOptions: InteractionEditReplyOptions = {
            content: payload.content,
            embeds: payload.embeds,
            components: payload.components,
            files: payload.files,
            allowedMentions: defaultAllowedMentions,
          };
          return await this.slashInteraction.editReply(editOptions);
        }

        return await this.slashInteraction.followUp({
          ...interactionOptions,
          fetchReply: true,
        });
      }

      if (this.slashInteraction.replied) {
        return await this.slashInteraction.followUp({
          ...interactionOptions,
          fetchReply: true,
        });
      }

      await this.slashInteraction.reply(interactionOptions);

      try {
        return await this.slashInteraction.fetchReply();
      } catch {
        return null;
      }
    } else if (this.message) {
      const messageOptions: MessageCreateOptions = {
        content: payload.content,
        embeds: payload.embeds,
        components: payload.components,
        files: payload.files,
        allowedMentions: defaultAllowedMentions,
      };

      try {
        return await this.message.reply(messageOptions);
      } catch {
        // Fallback: If target message was deleted or un-replyable, send directly in channel
        if (this.channel && 'send' in this.channel) {
          return await (this.channel as any).send(messageOptions);
        }
        return null;
      }
    }

    return null;
  }
}
