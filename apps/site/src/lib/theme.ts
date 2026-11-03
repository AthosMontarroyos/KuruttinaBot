import { useSyncExternalStore } from 'react';

/** `system` segue o sistema (padrão, nada é gravado); `light` e `dark` são a escolha do botão. */
type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

/** Mesma chave de `public/theme-init.js`, que aplica o tema salvo antes da primeira pintura. */
const themeStorageKey = 'kuruttina-theme';
const darkQuery = '(prefers-color-scheme: dark)';

const themeLabels: Record<ThemePreference, string> = {
  system: 'Tema: do sistema',
  light: 'Tema: claro',
  dark: 'Tema: escuro',
};

function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Um clique passa para o próximo estado: do sistema, claro, escuro, do sistema. */
function nextThemePreference(preference: ThemePreference): ThemePreference {
  if (preference === 'system') return 'light';
  return preference === 'light' ? 'dark' : 'system';
}

function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(themeStorageKey));
  } catch {
    return 'system';
  }
}

let preference: ThemePreference = typeof localStorage === 'undefined' ? 'system' : readStoredPreference();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Aplica e grava a escolha. `system` remove o atributo e a chave: o CSS volta a seguir o sistema. */
function setThemePreference(next: ThemePreference): void {
  preference = next;
  if (next === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', next);
  try {
    if (next === 'system') localStorage.removeItem(themeStorageKey);
    else localStorage.setItem(themeStorageKey, next);
  } catch {
    /* Sem armazenamento a escolha vale só nesta visita. */
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const query = window.matchMedia(darkQuery);
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== themeStorageKey && event.key !== null) return;
    preference = readStoredPreference();
    if (preference === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', preference);
    notify();
  };
  query.addEventListener('change', listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    query.removeEventListener('change', listener);
    window.removeEventListener('storage', onStorage);
  };
}

const getPreference = (): ThemePreference => preference;
const getSystemDark = (): boolean => window.matchMedia(darkQuery).matches;

/** Escolha do usuário e tema que está valendo agora (a escolha ou, em `system`, o do sistema). */
function useTheme(): { preference: ThemePreference; resolved: ResolvedTheme; cycle: () => void } {
  const current = useSyncExternalStore(subscribe, getPreference);
  const systemDark = useSyncExternalStore(subscribe, getSystemDark);
  return {
    preference: current,
    resolved: resolveTheme(current, systemDark),
    cycle: () => setThemePreference(nextThemePreference(current)),
  };
}

export { nextThemePreference, parseThemePreference, resolveTheme, themeLabels, themeStorageKey, useTheme };
export type { ResolvedTheme, ThemePreference };
