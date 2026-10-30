import { describe, expect, it } from 'vitest';
import { DISCORD_MESSAGE_LIMITS } from '@kuruttina/message-templates';
import { describeTemplateIssue, describeTemplateIssues } from '../apps/site/src/components/message-editor/format-issue.js';

describe('describeTemplateIssue', () => {
  it('diz qual campo tem valor e não tem nome', () => {
    expect(describeTemplateIssue({
      code: 'empty_text',
      path: 'embeds[0].fields[1].name',
      message: 'O texto não pode ficar vazio.',
    })).toBe('No campo 2, você escreveu o valor mas falta o nome.');
  });

  it('diz qual campo tem nome e não tem valor', () => {
    expect(describeTemplateIssue({
      code: 'empty_text',
      path: 'embeds[0].fields[0].value',
      message: 'O texto não pode ficar vazio.',
    })).toBe('No campo 1, você escreveu o nome mas falta o valor.');
  });

  it('cita o embed quando não é o primeiro', () => {
    expect(describeTemplateIssue({
      code: 'empty_text',
      path: 'embeds[1].fields[0].name',
      message: 'O texto não pode ficar vazio.',
    })).toBe('No embed 2, no campo 1, você escreveu o valor mas falta o nome.');
  });

  it('junta várias frases, uma por problema', () => {
    expect(describeTemplateIssues([
      { code: 'empty_text', path: 'embeds[0].fields[0].name', message: 'vazio' },
      { code: 'empty_text', path: 'embeds[0].fields[2].value', message: 'vazio' },
    ])).toEqual([
      'No campo 1, você escreveu o valor mas falta o nome.',
      'No campo 3, você escreveu o nome mas falta o valor.',
    ]);
  });

  it('usa o mesmo teto de caracteres do modelo de mensagem', () => {
    expect(describeTemplateIssue({
      code: 'limit_exceeded',
      path: 'embeds[0].fields[0].name',
      message: 'O texto pode passar de 256 caracteres.',
    })).toBe(`No campo 1, o nome passou de ${DISCORD_MESSAGE_LIMITS.fieldName} caracteres.`);
  });

  it('mantém a mensagem original quando o caminho não é reconhecido', () => {
    expect(describeTemplateIssue({
      code: 'invalid_action',
      path: 'components[0].buttons[0].action',
      message: 'Tipo de ação desconhecido.',
    })).toBe('Tipo de ação desconhecido.');
  });
});
