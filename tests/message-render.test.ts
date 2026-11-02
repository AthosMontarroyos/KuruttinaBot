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
  it('converte imagens e ícones do embed para o formato do Discord', () => {
    const reply = toCommandReply({
      embeds: [{
        title: 'T',
        thumbnail: { url: 'https://exemplo.com/t.png' },
        image: { url: 'https://exemplo.com/i.png' },
        footer: { text: 'F', iconUrl: 'https://exemplo.com/f.png' },
        author: { name: 'A', iconUrl: 'https://exemplo.com/a.png' },
      }],
      components: [],
    });
    expect(reply).toEqual({
      embeds: [{
        title: 'T', color: 0xf08db4,
        thumbnail: { url: 'https://exemplo.com/t.png' },
        image: { url: 'https://exemplo.com/i.png' },
        footer: { text: 'F', icon_url: 'https://exemplo.com/f.png' },
        author: { name: 'A', icon_url: 'https://exemplo.com/a.png' },
      }],
    });
  });

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
        title: 'T', description: 'D', url: 'https://exemplo.com', color: 0xf08db4,
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

  it('converte botão com emoji unicode, sem id nem animated', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{ kind: 'buttons', buttons: [
        { style: 'primary', label: 'Oi', customId: 'kt:a:1', emoji: { name: '😀' } },
        { style: 'link', label: 'Site', url: 'https://exemplo.com', emoji: { name: '🔗' } },
      ] }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    expect(reply.components).toEqual([{
      type: ComponentType.ActionRow,
      components: [
        { type: ComponentType.Button, style: ButtonStyle.Primary, label: 'Oi', custom_id: 'kt:a:1', emoji: { name: '😀' } },
        { type: ComponentType.Button, style: ButtonStyle.Link, label: 'Site', url: 'https://exemplo.com', emoji: { name: '🔗' } },
      ],
    }]);
  });

  it('converte emoji personalizado com id e animated, omitindo os campos ausentes', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{ kind: 'buttons', buttons: [
        { style: 'success', label: 'Animado', customId: 'kt:a:1', emoji: { id: '123456789012345678', name: 'dança', animated: true } },
        { style: 'success', label: 'Fixo', customId: 'kt:a:2', emoji: { id: '123456789012345678', name: 'logo_bot' } },
      ] }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    const [row] = reply.components ?? [];
    expect(row).toEqual({
      type: ComponentType.ActionRow,
      components: [
        { type: ComponentType.Button, style: ButtonStyle.Success, label: 'Animado', custom_id: 'kt:a:1', emoji: { id: '123456789012345678', name: 'dança', animated: true } },
        { type: ComponentType.Button, style: ButtonStyle.Success, label: 'Fixo', custom_id: 'kt:a:2', emoji: { id: '123456789012345678', name: 'logo_bot' } },
      ],
    });
    if (!row || !('components' in row)) throw new Error('esperava linha de botões');
    const [animated, fixed] = row.components as { emoji: object }[];
    expect(Object.keys(animated?.emoji ?? {}).sort()).toEqual(['animated', 'id', 'name']);
    expect(Object.keys(fixed?.emoji ?? {}).sort()).toEqual(['id', 'name']);
  });

  it('omite o rótulo vazio quando o botão tem emoji', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{ kind: 'buttons', buttons: [
        { style: 'secondary', label: '', customId: 'kt:a:1', emoji: { name: '⭐' } },
        { style: 'link', label: '', url: 'https://exemplo.com', emoji: { id: '123456789012345678', name: 'estrela' } },
      ] }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    const [row] = reply.components ?? [];
    if (!row || !('components' in row)) throw new Error('esperava linha de botões');
    const [colored, link] = row.components as object[];
    expect(colored).not.toHaveProperty('label');
    expect(colored).toEqual({ type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: 'kt:a:1', emoji: { name: '⭐' } });
    expect(link).not.toHaveProperty('label');
    expect(link).toEqual({ type: ComponentType.Button, style: ButtonStyle.Link, url: 'https://exemplo.com', emoji: { id: '123456789012345678', name: 'estrela' } });
  });

  it('omite o rótulo só com espaços quando o botão tem emoji', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{ kind: 'buttons', buttons: [
        { style: 'primary', label: '   ', customId: 'kt:a:1', emoji: { name: '🔥' } },
      ] }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    const [row] = reply.components ?? [];
    if (!row || !('components' in row)) throw new Error('esperava linha de botões');
    const [button] = row.components as object[];
    expect(button).not.toHaveProperty('label');
    expect(button).toEqual({ type: ComponentType.Button, style: ButtonStyle.Primary, custom_id: 'kt:a:1', emoji: { name: '🔥' } });
  });

  it('envia o id do Component no custom_id de botão colorido', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{ kind: 'buttons', buttons: [
        { style: 'primary', label: 'Com', customId: 'kt:b:abc12345', component: 7 },
        { style: 'primary', label: 'Sem', customId: 'kt:b:abc12345' },
        { style: 'primary', label: 'Um', customId: 'kt:b:one', component: 7 },
        { style: 'primary', label: 'Dois', customId: 'kt:b:two', component: 7 },
      ] }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    const [row] = reply.components ?? [];
    if (!row || !('components' in row)) throw new Error('esperava linha de botões');
    const [withComponent, withoutComponent, one, two] = row.components as { custom_id?: string }[];
    expect(withComponent?.custom_id).toBe('kt:c:7-abc12345');
    expect(withoutComponent?.custom_id).toBe('kt:b:abc12345');
    expect(one?.custom_id).toBe('kt:c:7-one');
    expect(two?.custom_id).toBe('kt:c:7-two');
    expect(one?.custom_id).not.toBe(two?.custom_id);
  });

  it('usa o índice do botão quando o sufixo do customId fica vazio e respeita 100 caracteres', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{ kind: 'buttons', buttons: [
        { style: 'danger', label: 'Vazio', customId: 'kt:b:', component: 12 },
        { style: 'danger', label: 'Longo', customId: `kt:b:${'a'.repeat(80)}`, component: 12 },
      ] }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    const [row] = reply.components ?? [];
    if (!row || !('components' in row)) throw new Error('esperava linha de botões');
    const [empty, long] = row.components as { custom_id?: string }[];
    expect(empty?.custom_id).toBe('kt:c:12-0');
    expect(long?.custom_id).toBe(`kt:c:12-${'a'.repeat(40)}`);
    expect(long?.custom_id?.length).toBeLessThanOrEqual(100);
  });

  it('converte menu de seleção sem enviar a ação da opção', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{
        kind: 'select',
        menu: {
          customId: 'kt:menu:roles',
          placeholder: 'Escolha',
          options: [{ label: 'Cargo', value: 'cargo', description: 'Um cargo', action: { type: 'delete' } }],
        },
      }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    expect(reply.components).toEqual([{
      type: ComponentType.ActionRow,
      components: [{
        type: ComponentType.StringSelect,
        custom_id: 'kt:menu:roles',
        placeholder: 'Escolha',
        options: [{ label: 'Cargo', value: 'cargo', description: 'Um cargo' }],
      }],
    }]);
  });

  it('envia menu com Component: custom_id com o id, valores com chave e índice, emoji, default e limites', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{
        kind: 'select',
        menu: {
          customId: 'kt:menu:cargos',
          component: 3,
          placeholder: 'Escolha',
          minValues: 1,
          maxValues: 2,
          options: [
            { label: 'Azul', value: 'azul', description: 'Cor', componentOption: 'k1abc234', emoji: { name: '🔵' }, default: true, action: { type: 'delete' } },
            { label: 'Verde', value: 'verde', componentOption: 'z9zzz999', emoji: { id: '123456789012345678', name: 'verde', animated: true } },
          ],
        },
      }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    expect(reply.components).toEqual([{
      type: ComponentType.ActionRow,
      components: [{
        type: ComponentType.StringSelect,
        custom_id: 'kt:s:3-cargos',
        placeholder: 'Escolha',
        min_values: 1,
        max_values: 2,
        options: [
          { label: 'Azul', value: 'k1abc234:0', description: 'Cor', emoji: { name: '🔵' }, default: true },
          { label: 'Verde', value: 'z9zzz999:1', emoji: { id: '123456789012345678', name: 'verde', animated: true } },
        ],
      }],
    }]);
  });

  it('usa 0 como sufixo quando o customId do menu fica vazio, omite default falso e mantém o value sem componentOption', () => {
    const reply = toCommandReply({
      embeds: [],
      components: [{
        kind: 'select',
        menu: {
          customId: 'kt:menu:',
          component: 5,
          options: [
            { label: 'Um', value: 'um', default: false },
            { label: 'Dois', value: 'dois', componentOption: 'abc12345', default: false },
          ],
        },
      }],
    });
    if (typeof reply === 'string') throw new Error('esperava resposta com componentes');
    const [row] = reply.components ?? [];
    if (!row || !('components' in row)) throw new Error('esperava linha de menu');
    const [menu] = row.components as { custom_id?: string; options: object[]; min_values?: number; max_values?: number }[];
    expect(menu?.custom_id).toBe('kt:s:5-0');
    expect(menu).not.toHaveProperty('min_values');
    expect(menu).not.toHaveProperty('max_values');
    expect(menu?.options).toEqual([
      { label: 'Um', value: 'um' },
      { label: 'Dois', value: 'abc12345:1' },
    ]);
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
