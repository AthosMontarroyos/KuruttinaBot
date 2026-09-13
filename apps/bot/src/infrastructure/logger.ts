import type { BotTarget } from '#bot/config.js';
import { formatTerminalLog, shouldUseTerminalColors, type TerminalLogLevel } from './terminalFormatter.js';

export type LogLevel = TerminalLogLevel;
type LogFields = Record<string, unknown>;
type LogStream = Pick<NodeJS.WriteStream, 'isTTY' | 'write'>;
type LogPresentation = 'json' | 'pretty';

let presentation: LogPresentation = 'json';

export function configureLogger(target: BotTarget): void {
  presentation = target === 'development' ? 'pretty' : 'json';
}

function supportsColor(stream: LogStream): boolean {
  return presentation === 'pretty' && shouldUseTerminalColors('development', stream.isTTY, process.env);
}

function formatJsonLog(level: LogLevel, event: string, fields: LogFields): string {
  return JSON.stringify({
    ...fields,
    timestamp: new Date().toISOString(),
    level: level === 'success' ? 'info' : level,
    service: 'bot',
    event,
  });
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  const output = presentation === 'pretty'
    ? formatTerminalLog(level, event, fields, supportsColor(stream))
    : formatJsonLog(level, event, fields);
  stream.write(`${output}\n`);
}
