import type { GuildTextBasedChannel } from 'discord.js';
import type { BulkDeletePort } from '#bot/command-system/types.js';

type ClearChannelPort = Pick<GuildTextBasedChannel, 'bulkDelete' | 'isThread'> & {
  readonly messages: Pick<GuildTextBasedChannel['messages'], 'fetch' | 'delete'>;
};

export function createClearChannelAdapter(channel: ClearChannelPort): BulkDeletePort {
  return {
    isThread: channel.isThread(),
    async fetchMessages({ limit, before }) {
      // Return raw messages sorted newest-first; the command filters age and author.
      const messages = await channel.messages.fetch({
        limit: Math.min(limit, 100),
        ...(before ? { before } : {}),
      });

      return [...messages.values()]
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
        .map((msg) => ({
          id: msg.id,
          createdTimestamp: msg.createdTimestamp,
          author: { id: msg.author.id },
        }));
    },

    async bulkDelete(messages) {
      if (messages.length === 0) return 0;
      if (messages.length === 1) {
        const first = messages[0];
        if (!first) return 0;
        return await this.deleteMessage(first.id) ? 1 : 0;
      }
      // Discord accepts at most 100 messages per bulk request.
      let deleted = 0;
      for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100);
        const result = await channel.bulkDelete(batch.map((m) => m.id), true);
        deleted += result.size;
      }
      return deleted;
    },

    async deleteMessage(messageId) {
      try {
        await channel.messages.delete(messageId);
        return true;
      } catch {
        return false;
      }
    },
  };
}
