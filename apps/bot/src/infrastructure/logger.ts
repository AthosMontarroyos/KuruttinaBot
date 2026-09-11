type LogLevel = 'info' | 'error';

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  console[level](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'bot',
      event,
      ...fields,
    }),
  );
}
