import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureLogger, log } from '../apps/bot/src/infrastructure/logger.js';
import { formatTerminalLog, shouldUseTerminalColors } from '../apps/bot/src/infrastructure/terminalFormatter.js';

afterEach(() => {
  configureLogger('production');
  vi.restoreAllMocks();
});

describe('terminal logger', () => {
  it('keeps production logs structured and sends errors to stderr', () => {
    configureLogger('production');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    log('info', 'ready', { correlationId: 'correlation-id' });
    log('error', 'startup_failed', { errorName: 'ExampleError' });

    const info = JSON.parse(String(stdout.mock.calls[0]?.[0])) as Record<string, unknown>;
    const error = JSON.parse(String(stderr.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(info).toMatchObject({ level: 'info', service: 'bot', event: 'ready', correlationId: 'correlation-id' });
    expect(error).toMatchObject({ level: 'error', service: 'bot', event: 'startup_failed', errorName: 'ExampleError' });
    expect(info.timestamp).toEqual(expect.any(String));
  });

  it('formats development logs with hierarchy and optional ANSI colors', () => {
    const plain = formatTerminalLog('error', 'command_failed', { command: 'ping', errorName: 'ExampleError' }, false);
    const colored = formatTerminalLog('error', 'command_failed', { command: 'ping' }, true);

    expect(plain).toContain('❌ Discord');
    expect(plain).toContain('Falha ao executar interaction');
    expect(plain).toContain('command: ping');
    expect(plain).not.toContain('\u001B[');
    expect(colored).toContain('\u001B[31m');
  });

  it('keeps redirected development output readable without ANSI sequences', () => {
    configureLogger('development');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    log('success', 'config_loaded', { target: 'development' });

    const output = String(stdout.mock.calls[0]?.[0]);
    expect(output).toContain('⚙️ Config');
    expect(output).toContain('target=development');
    expect(output).not.toContain('\u001B[');
  });

  it('enables colors only for an interactive development terminal that permits them', () => {
    expect(shouldUseTerminalColors('development', true, {})).toBe(true);
    expect(shouldUseTerminalColors('development', false, {})).toBe(false);
    expect(shouldUseTerminalColors('development', true, { NO_COLOR: '' })).toBe(false);
    expect(shouldUseTerminalColors('production', true, {})).toBe(false);
  });

  it('uses the shared terminal hierarchy for build events', () => {
    expect(formatTerminalLog('info', 'build_started', {}, false)).toContain('🔨 Build');
    expect(formatTerminalLog('success', 'build_completed', { durationMs: 42 }, false))
      .toContain('✅ Build      Bot compilado com sucesso  durationMs=42');
  });
});
