import { enUS, TranslationKeys } from './locales/en-US';
import { ptBR } from './locales/pt-BR';

export type Locale = 'en-US' | 'pt-BR';

export const DEFAULT_LOCALE: Locale = 'en-US';

export const LOCALES: Record<Locale, TranslationKeys> = {
  'en-US': enUS,
  'pt-BR': ptBR,
};

export function getTranslations(locale: Locale = DEFAULT_LOCALE): TranslationKeys {
  return LOCALES[locale] || LOCALES[DEFAULT_LOCALE];
}

export * from './locales/en-US';
export * from './locales/pt-BR';
