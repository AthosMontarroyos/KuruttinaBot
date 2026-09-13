import type { BotTarget } from '#bot/config.js';
import { terminalColors } from './terminalColors.js';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

type LogFields = Record<string, unknown>;
type LogStream = Pick<NodeJS.WriteStream, 'isTTY' | 'write'>;
type LogPresentation = 'json' | 'pretty';

type EventPresentation = Readonly<{ emoji: string; category: string; message: string }>;

const eventPresentations: Readonly<Record<string, EventPresentation>> = {
  config_loaded: { emoji: '⚙️', category: 'Config', message: 'Configuração validada' },
  command_loaded: { emoji: '📦', category: 'Commands', message: 'Comando carregado' },
  identity_validation_started: { emoji: '🤖', category: 'Discord', message: 'Validando identidade do bot' },
  identity_validated: { emoji: '✅', category: 'Discord', message: 'Identidade do bot validada' },
  command_sync_skipped: { emoji: 'ℹ️', category: 'Sync', message: 'Sincronização automática desativada' },
  deployment_started: { emoji: '🔄', category: 'Sync', message: 'Sincronizando comandos' },
  deployment_completed: { emoji: '✅', category: 'Sync', message: 'Comandos sincronizados' },
  central_commands_deployed: { emoji: '✅', category: 'Sync', message: 'Comandos globais sincronizados' },
  gateway_connecting: { emoji: '🌐', category: 'Gateway', message: 'Conectando ao Discord' },
  ready: { emoji: '🚀', category: 'Bot', message: 'Bot pronto' },
  shutdown_started: { emoji: '🛑', category: 'Shutdown', message: 'Encerrando bot' },
  shutdown_completed: { emoji: '✅', category: 'Shutdown', message: 'Bot encerrado corretamente' },
  startup_failed: { emoji: '❌', category: 'Startup', message: 'Falha ao iniciar o bot' },
  command_failed: { emoji: '❌', category: 'Discord', message: 'Falha ao executar interaction' },
  command_failure_response_failed: { emoji: '❌', category: 'Discord', message: 'Falha ao responder interaction com erro' },
  prefix_command_failed: { emoji: '❌', category: 'Commands', message: 'Falha ao executar comando por prefixo' },
  central_command_deployment_failed: { emoji: '❌', category: 'Sync', message: 'Falha ao sincronizar comandos globais' },
};

const levelPresentations: Readonly<Record<LogLevel, EventPresentation>> = {
  info: { emoji: 'ℹ️', category: 'Info', message: 'Informação' },
  success: { emoji: '✅', category: 'Success', message: 'Operação concluída' },
  warn: { emoji: '⚠️', category: 'Warn', message: 'Aviso' },
  error: { emoji: '❌', category: 'Error', message: 'Falha' },
};

let presentation: LogPresentation = 'json';

export function configureLogger(target: BotTarget): void {
  presentation = target === 'development' ? 'pretty' : 'json';
}

export function shouldUseTerminalColors(
  target: BotTarget,
  isTTY: boolean | undefined,
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return target === 'development' && isTTY === true && env.NO_COLOR === undefined && env.TERM !== 'dumb';
}

function supportsColor(stream: LogStream): boolean {
  return presentation === 'pretty' && shouldUseTerminalColors('development', stream.isTTY, process.env);
}

function colorFor(level: LogLevel, category: string): string {
  if (level === 'error') return terminalColors.red;
  if (level === 'warn') return terminalColors.yellow;
  if (level === 'success') return terminalColors.green;
  if (category === 'Discord' || category === 'Bot') return terminalColors.magenta;
  return terminalColors.cyan;
}

function serializeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

export function formatPrettyLog(level: LogLevel, event: string, fields: LogFields, colorsEnabled: boolean): string {
  const visual = eventPresentations[event] ?? levelPresentations[level];
  const category = visual.category.padEnd(10);
  const prefix = `${visual.emoji} ${category}`;
  const styledPrefix = colorsEnabled
    ? `${colorFor(level, visual.category)}${terminalColors.bold}${prefix}${terminalColors.reset}`
    : prefix;
  const metadata = Object.entries(fields);
  if (metadata.length === 0) return `${styledPrefix} ${visual.message}`;

  const metadataColor = colorsEnabled ? terminalColors.gray : '';
  const reset = colorsEnabled ? terminalColors.reset : '';
  if (level !== 'error') {
    const details = metadata.map(([key, value]) => `${key}=${serializeValue(value)}`).join('  ');
    return `${styledPrefix} ${visual.message}  ${metadataColor}${details}${reset}`;
  }

  const details = metadata.map(([key, value]) => `   ${metadataColor}${key}:${reset} ${serializeValue(value)}`);
  return `${styledPrefix} ${visual.message}\n\n${details.join('\n')}`;
}

function formatJsonLog(level: LogLevel, event: string, fields: LogFields): string {
  const productionLevel = level === 'success' ? 'info' : level;
  return JSON.stringify({
    ...fields,
    timestamp: new Date().toISOString(),
    level: productionLevel,
    service: 'bot',
    event,
  });
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  const output = presentation === 'pretty'
    ? formatPrettyLog(level, event, fields, supportsColor(stream))
    : formatJsonLog(level, event, fields);
  stream.write(`${output}\n`);
}
