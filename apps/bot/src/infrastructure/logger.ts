import type { BotTarget } from '#bot/config.js';
import { formatTerminalLog, shouldUseTerminalColors, type TerminalLogLevel } from './terminalFormatter.js';

export type LogLevel = TerminalLogLevel;
type LogFields = Record<string, unknown>;
type LogStream = Pick<NodeJS.WriteStream, 'isTTY' | 'write'>;

let environment: BotTarget = 'production';

export function configureLogger(target: BotTarget): void {
  environment = target;
}

function supportsColor(stream: LogStream): boolean {
  return shouldUseTerminalColors(environment, stream.isTTY, process.env);
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  const output = formatTerminalLog(level, event, fields, supportsColor(stream));
  stream.write(`${output}\n`);
}
