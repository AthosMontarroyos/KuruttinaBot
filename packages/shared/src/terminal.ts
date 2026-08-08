/**
 * Estilos e Cores ANSI para Formatação de Logs no Terminal / Console.
 */
export interface TerminalColorStyle {
  raw: string;
  apply: (text: string) => string;
}

export const TERMINAL_STYLES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
} as const;

export const TERMINAL_COLORS = {
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
} as const;

/**
 * Utilitário de Formatação de Cores do Terminal.
 */
export const loggerColors = {
  success: (text: string) => `${TERMINAL_COLORS.brightGreen}${TERMINAL_STYLES.bold}${text}${TERMINAL_STYLES.reset}`,
  error: (text: string) => `${TERMINAL_COLORS.brightRed}${TERMINAL_STYLES.bold}${text}${TERMINAL_STYLES.reset}`,
  warn: (text: string) => `${TERMINAL_COLORS.brightYellow}${TERMINAL_STYLES.bold}${text}${TERMINAL_STYLES.reset}`,
  info: (text: string) => `${TERMINAL_COLORS.brightCyan}${text}${TERMINAL_STYLES.reset}`,
  highlight: (text: string) => `${TERMINAL_COLORS.brightMagenta}${TERMINAL_STYLES.bold}${text}${TERMINAL_STYLES.reset}`,
  muted: (text: string) => `${TERMINAL_COLORS.gray}${text}${TERMINAL_STYLES.reset}`,
  bold: (text: string) => `${TERMINAL_STYLES.bold}${text}${TERMINAL_STYLES.reset}`,
};
