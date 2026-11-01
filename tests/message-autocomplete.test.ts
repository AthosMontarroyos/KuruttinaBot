import { describe, expect, it } from 'vitest';
import { applySuggestion, detectTrigger, filterSuggestions, mentionText, type SuggestionItem } from '../apps/site/src/components/message-editor/autocomplete.js';

const smile: SuggestionItem = { kind: 'emoji', id: '333', name: 'smile', animated: false, url: 'https://cdn.discordapp.com/emojis/333.png' };
const channel: SuggestionItem = { kind: 'channel', id: '111', name: 'geral', group: null, voice: false };
const role: SuggestionItem = { kind: 'role', id: '222', name: 'Mod', color: null };

describe('detectTrigger', () => {
  it('opens at the start of the text', () => {
    expect(detectTrigger(':smi', 4)).toEqual({ kind: 'emoji', query: 'smi', start: 0, end: 4 });
  });

  it('opens after a space or a line break', () => {
    expect(detectTrigger('oi #ge', 6)).toEqual({ kind: 'channel', query: 'ge', start: 3, end: 6 });
    expect(detectTrigger('a\n@mo', 5)).toEqual({ kind: 'role', query: 'mo', start: 2, end: 5 });
  });

  it('opens with an empty query right after the trigger', () => {
    expect(detectTrigger('oi :', 4)).toEqual({ kind: 'emoji', query: '', start: 3, end: 4 });
  });

  it('reads the query up to the caret, not the end of the text', () => {
    expect(detectTrigger('oi :gat bom', 7)).toEqual({ kind: 'emoji', query: 'gat', start: 3, end: 7 });
  });

  it('does not open for a time, a URL, an emoji tag or a markdown heading', () => {
    expect(detectTrigger('12:30', 5)).toBeNull();
    expect(detectTrigger('https://x.com', 13)).toBeNull();
    expect(detectTrigger('<:nome:123', 10)).toBeNull();
    expect(detectTrigger('# Título', 8)).toBeNull();
  });

  it('does not open when a space sits between the trigger and the caret', () => {
    expect(detectTrigger(': gat', 5)).toBeNull();
    expect(detectTrigger('# ', 2)).toBeNull();
  });

  it('accepts accented letters in the query', () => {
    expect(detectTrigger(':ação', 5)).toEqual({ kind: 'emoji', query: 'ação', start: 0, end: 5 });
  });

  it('accepts a query of 32 characters and rejects 33', () => {
    expect(detectTrigger(`:${'a'.repeat(32)}`, 33)?.query).toBe('a'.repeat(32));
    expect(detectTrigger(`:${'a'.repeat(33)}`, 34)).toBeNull();
  });
});

describe('filterSuggestions', () => {
  const items = [{ name: 'chat-geral' }, { name: 'geral' }, { name: 'Geração' }, { name: 'aviso' }];

  it('lists names that start with the query first, then names that contain it, keeping the original order', () => {
    expect(filterSuggestions(items, 'ger')).toEqual([{ name: 'geral' }, { name: 'Geração' }, { name: 'chat-geral' }]);
  });

  it('ignores case and accents', () => {
    expect(filterSuggestions([{ name: 'Ação' }, { name: 'aviso' }], 'acao')).toEqual([{ name: 'Ação' }]);
    expect(filterSuggestions([{ name: 'Ação' }, { name: 'aviso' }], 'AÇÃO')).toEqual([{ name: 'Ação' }]);
  });

  it('returns the first items in order for an empty query, capped by the limit', () => {
    expect(filterSuggestions(items, '', 2)).toEqual([{ name: 'chat-geral' }, { name: 'geral' }]);
  });

  it('caps the result at 50 by default', () => {
    const many = Array.from({ length: 60 }, (_, index) => ({ name: `canal${index}` }));
    expect(filterSuggestions(many, 'canal')).toHaveLength(50);
  });
});

describe('mentionText', () => {
  it('writes the mention the Discord reads', () => {
    expect(mentionText(channel)).toBe('<#111>');
    expect(mentionText(role)).toBe('<@&222>');
    expect(mentionText(smile)).toBe('<:smile:333>');
    expect(mentionText({ ...smile, animated: true })).toBe('<a:smile:333>');
  });
});

describe('applySuggestion', () => {
  it('replaces the query and adds a space when none follows', () => {
    const trigger = detectTrigger('oi :sm', 6);
    expect(trigger).not.toBeNull();
    const result = applySuggestion('oi :sm', trigger!, smile, 2000);
    expect(result).toEqual({ text: 'oi <:smile:333> ', caret: 16 });
  });

  it('does not add a second space when one already follows', () => {
    const trigger = detectTrigger('oi :sm bom', 6);
    const result = applySuggestion('oi :sm bom', trigger!, smile, 2000);
    expect(result).toEqual({ text: 'oi <:smile:333> bom', caret: 15 });
  });

  it('adds the space when a word follows without one', () => {
    const trigger = detectTrigger(':smbom', 3);
    const result = applySuggestion(':smbom', trigger!, smile, 2000);
    expect(result).toEqual({ text: '<:smile:333> bom', caret: 13 });
  });

  it('inserts channel mentions the same way', () => {
    const trigger = detectTrigger('#ge', 3);
    expect(applySuggestion('#ge', trigger!, channel, 2000)).toEqual({ text: '<#111> ', caret: 7 });
  });

  it('returns null when the result would pass maxLength', () => {
    const trigger = detectTrigger('oi :sm', 6);
    expect(applySuggestion('oi :sm', trigger!, smile, 15)).toBeNull();
    expect(applySuggestion('oi :sm', trigger!, smile, 16)).not.toBeNull();
  });
});
