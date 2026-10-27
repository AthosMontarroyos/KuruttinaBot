import { describe, expect, it, vi } from 'vitest';
import { ButtonStyle, ComponentType } from 'discord.js';
import { createEmojiResolver, createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import { toCommandReply } from '../apps/bot/src/infrastructure/discord/messages/toCommandReply.js';

vi.mock('#bot/application/messages/catalog.js', () => ({
  MESSAGE_CATALOG: {
    demo: {
      template: { content: '{emoji.id} Olá, {nome}!', embeds: [], components: [] },
      variables: [{ name: 'nome', maxLength: 20 }],
      emojis: { id: 'ID' },
    },
  },
}));

describe('toCommandReply', () => {
  it('converte embed completo com a cor padrão', () => {
    const reply = toCommandReply({
      content: 'oi',
      embeds: [{
        title: 'T', description: 'D', url: 'https://exemplo.com',
        fields: [{ name: 'a', value: 'b', inline: true }, { name: 'c', value: 'd' }],
        footer: { text: 'F' }, author: { name: 'A', url: 'https://exemplo.com/a' },
      }],
      components: [],
    });
    expect(reply).toEqual({
      content: 'oi',
      embeds: [{
        title: 'T', description: 'D', url: 'https://exemplo.com', color: 0x2b2d31,
        fields: [{ name: 'a', value: 'b', inline: true }, { name: 'c', value: 'd' }],
        footer: { text: 'F' }, author: { name: 'A', url: 'https://exemplo.com/a' },
      }],
    });
  });

  it('respeita a cor do template e omite content indefinido', () => {
    const reply = toCommandReply({ embeds: [{ color: 0xff0000 }], components: [] });
    expect(reply).toEqual({ embeds: [{ color: 0xff0000 }] });
  });

  it('converte botões de link e de resposta', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{ kind: 'buttons', buttons: [
        { style: 'link', label: 'Abrir', url: 'https://exemplo.com' },
        { style: 'danger', label: 'Apagar', customId: 'apagar' },
      ] }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    expect(reply.components).toEqual([{
      type: ComponentType.ActionRow,
      components: [
        { type: ComponentType.Button, style: ButtonStyle.Link, label: 'Abrir', url: 'https://exemplo.com' },
        { type: ComponentType.Button, style: ButtonStyle.Danger, label: 'Apagar', custom_id: 'apagar' },
      ],
    }]);
  });

  it('falha com menu de seleção', () => {
    expect(() => toCommandReply({
      embeds: [],
      components: [{ kind: 'select', menu: { customId: 'm', options: [{ label: 'a', value: 'b' }] } }],
    })).toThrow(/menu/);
  });
});

describe('createRenderer', () => {
  it('lança erro interno para chave desconhecida', async () => {
    const render = createRenderer(async () => '');
    await expect(render('inexistente' as never)).rejects.toThrow(/desconhecida/);
  });

  it('resolve emojis com o emoji injetado', async () => {
    const render = createRenderer(async (name) => `<:${name}:1>`);
    expect(await render('demo' as never, { nome: 'Ana' })).toBe('<:ID:1> Olá, Ana!');
  });

  it('cai no fallback quando a resolução falha', async () => {
    const render = createRenderer(createEmojiResolver({ emojis: { fetch: vi.fn().mockRejectedValue(new Error('x')) } }));
    expect(await render('demo' as never, { nome: 'Ana' })).toBe('🪪 Olá, Ana!');
  });
});
