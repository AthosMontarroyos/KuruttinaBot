import { describe, expect, it } from 'vitest';
import { unlinkComponent } from '@kuruttina/message-templates';

const buttonRow = (...buttons: Record<string, unknown>[]) => ({ kind: 'buttons', buttons });
const menuRow = (menu: Record<string, unknown>) => ({ kind: 'select', menu });

describe('unlinkComponent', () => {
  it('desvincula o botão com o id e deixa o botão de outro id como está', () => {
    const content = {
      content: 'Escolha',
      embeds: [],
      components: [buttonRow(
        { style: 'primary', label: 'Sim', customId: 'sim', component: 7 },
        { style: 'danger', label: 'Não', customId: 'nao', component: 8 },
        { style: 'secondary', label: 'Sem ação', customId: 'semacao' },
      )],
    };
    const result = unlinkComponent(content, 'button', 7);
    expect(result.changed).toBe(true);
    expect(result.content).toEqual({
      content: 'Escolha',
      embeds: [],
      components: [buttonRow(
        { style: 'primary', label: 'Sim', customId: 'sim' },
        { style: 'danger', label: 'Não', customId: 'nao', component: 8 },
        { style: 'secondary', label: 'Sem ação', customId: 'semacao' },
      )],
    });
  });

  it('desvincula vários botões com o mesmo id, em linhas diferentes', () => {
    const content = {
      content: 'x',
      embeds: [],
      components: [
        buttonRow({ style: 'success', label: 'A', customId: 'a', component: 3 }, { style: 'success', label: 'B', customId: 'b', component: 3 }),
        buttonRow({ style: 'success', label: 'C', customId: 'c', component: 3 }),
      ],
    };
    const result = unlinkComponent(content, 'button', 3);
    expect(result.changed).toBe(true);
    expect(result.content).toEqual({
      content: 'x',
      embeds: [],
      components: [
        buttonRow({ style: 'success', label: 'A', customId: 'a' }, { style: 'success', label: 'B', customId: 'b' }),
        buttonRow({ style: 'success', label: 'C', customId: 'c' }),
      ],
    });
  });

  it('um botão com o id não mexe no menu de mesmo id: tipos diferentes', () => {
    const content = {
      content: 'x',
      embeds: [],
      components: [menuRow({ customId: 'm', component: 5, options: [{ label: 'O', value: 'o', componentOption: 'a1b2c3' }] })],
    };
    const result = unlinkComponent(content, 'button', 5);
    expect(result).toEqual({ content, changed: false });
    expect(result.content).toBe(content);
  });

  it('menu com o id perde component e componentOption de todas as opções', () => {
    const content = {
      content: 'x',
      embeds: [],
      components: [menuRow({
        customId: 'cargos',
        placeholder: 'Escolha',
        component: 9,
        options: [
          { label: 'Sim', value: 'sim', componentOption: 'a1b2c3' },
          { label: 'Não', value: 'nao', componentOption: 'd4e5f6', default: true },
          { label: 'Sem chave', value: 'semchave' },
        ],
      })],
    };
    const result = unlinkComponent(content, 'select', 9);
    expect(result.changed).toBe(true);
    expect(result.content).toEqual({
      content: 'x',
      embeds: [],
      components: [menuRow({
        customId: 'cargos',
        placeholder: 'Escolha',
        options: [
          { label: 'Sim', value: 'sim' },
          { label: 'Não', value: 'nao', default: true },
          { label: 'Sem chave', value: 'semchave' },
        ],
      })],
    });
  });

  it('menu de outro id fica intacto, com component e componentOption', () => {
    const menu = { customId: 'outro', component: 10, options: [{ label: 'Sim', value: 'sim', componentOption: 'a1b2c3' }] };
    const content = { content: 'x', embeds: [], components: [menuRow(menu)] };
    const result = unlinkComponent(content, 'select', 9);
    expect(result).toEqual({ content, changed: false });
    expect(result.content).toBe(content);
  });

  it('conteúdo sem componentes devolve changed false e a mesma referência', () => {
    const content = { content: 'Olá', embeds: [{ title: 'T' }], components: [] };
    const result = unlinkComponent(content, 'button', 1);
    expect(result).toEqual({ content, changed: false });
    expect(result.content).toBe(content);
    expect(unlinkComponent(content, 'select', 1).content).toBe(content);
  });

  it('não muta a entrada, nem o botão, nem o menu, nem as opções', () => {
    const content = {
      content: 'x',
      embeds: [],
      components: [
        buttonRow({ style: 'primary', label: 'Sim', customId: 'sim', component: 4 }),
        menuRow({ customId: 'm', component: 4, options: [{ label: 'O', value: 'o', componentOption: 'a1b2c3' }] }),
      ],
    };
    const snapshot = structuredClone(content);
    const result = unlinkComponent(content, 'button', 4);
    expect(content).toEqual(snapshot);
    expect(result.content).not.toBe(content);
    expect((content.components[0] as { buttons: Record<string, unknown>[] }).buttons[0]).toEqual({ style: 'primary', label: 'Sim', customId: 'sim', component: 4 });

    const selectResult = unlinkComponent(content, 'select', 4);
    expect(content).toEqual(snapshot);
    expect(selectResult.changed).toBe(true);
    expect(selectResult.content).not.toBe(content);
    expect((content.components[1] as { menu: Record<string, unknown> }).menu).toEqual((snapshot.components[1] as { menu: Record<string, unknown> }).menu);
  });

  it('aceita o id como número e não casa id em forma de texto', () => {
    const content = {
      content: 'x',
      embeds: [],
      components: [buttonRow({ style: 'primary', label: 'Sim', customId: 'sim', component: 12 })],
    };
    expect(unlinkComponent(content, 'button', 12).changed).toBe(true);
    expect(unlinkComponent(content, 'button', 1).changed).toBe(false);
    const asText = { content: 'x', embeds: [], components: [buttonRow({ style: 'primary', label: 'Sim', customId: 'sim', component: '12' })] };
    expect(unlinkComponent(asText, 'button', 12)).toEqual({ content: asText, changed: false });
  });
});
