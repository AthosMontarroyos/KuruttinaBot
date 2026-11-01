import { describe, expect, it } from 'vitest';
import { keepRenderable, twemojiUrl, usesFlagImage } from '../apps/site/src/components/selectors/emoji-support.js';

describe('usesFlagImage', () => {
  it('desenha como imagem a bandeira de país e as de região', () => {
    expect(usesFlagImage('🇧🇷')).toBe(true);
    expect(usesFlagImage('🏴󠁧󠁢󠁥󠁮󠁧󠁿')).toBe(true);
  });

  it('não usa imagem para a bandeira que o Twemoji ainda não tem', () => {
    expect(usesFlagImage('🇨🇶')).toBe(false);
  });

  it('deixa as outras bandeiras e emojis como texto', () => {
    expect(usesFlagImage('🏁')).toBe(false);
    expect(usesFlagImage('🏳️‍🌈')).toBe(false);
    expect(usesFlagImage('🏴')).toBe(false);
    expect(usesFlagImage('😀')).toBe(false);
  });
});

describe('twemojiUrl', () => {
  const base = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg';

  it('usa os pontos de código em hexadecimal, separados por hífen', () => {
    expect(twemojiUrl('🇧🇷')).toBe(`${base}/1f1e7-1f1f7.svg`);
    expect(twemojiUrl('🏴󠁧󠁢󠁥󠁮󠁧󠁿')).toBe(`${base}/1f3f4-e0067-e0062-e0065-e006e-e0067-e007f.svg`);
  });

  it('tira o seletor de emoji (fe0f) quando não há junção, mas o mantém numa sequência com ZWJ', () => {
    expect(twemojiUrl('🏳️')).toBe(`${base}/1f3f3.svg`);
    expect(twemojiUrl('🏳️‍🌈')).toBe(`${base}/1f3f3-fe0f-200d-1f308.svg`);
  });
});

describe('keepRenderable', () => {
  it('devolve os dados como vieram quando não há DOM', () => {
    const categories = [{ id: 'bandeiras', emojis: [{ unicode: '🇧🇷' }] }];
    expect(keepRenderable(categories)).toBe(categories);
  });
});
