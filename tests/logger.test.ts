import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureLogger, log } from '../apps/bot/src/infrastructure/logging/logger.js';
import { formatTerminalLog, shouldUseTerminalColors } from '../apps/bot/src/infrastructure/logging/terminalFormatter.js';

afterEach(() => {
  configureLogger('production');
  vi.restoreAllMocks();
});

describe('terminal logger', () => {
  it.each([
    ['clear_fetch_failed', 'Falha ao buscar mensagens'],
    ['clear_delete_failed', 'Falha ao apagar mensagens'],
    ['clear_confirm_failed', 'Exclusão concluída; falha ao enviar confirmação'],
    ['clear_unexpected_error', 'Erro inesperado na limpeza de mensagens'],
    ['kick_failed', 'Falha ao expulsar o membro'],
    ['kick_confirm_failed', 'Expulsão concluída; falha ao enviar confirmação'],
  ])('identifies the moderation stage for %s', (event, message) => {
    const output = formatTerminalLog('error', event!, { channelId: 'channel-123', errorCode: 50013 }, false);
    const category = event?.startsWith('kick_') ? '❌ Kick' : '❌ Clear';
    expect(output).toContain(category);
    expect(output).toContain(message);
    expect(output).toContain('channelId: channel-123');
    expect(output).toContain('errorCode: 50013');
  });

  it('uses the human format without ANSI in production and preserves stderr', () => {
    configureLogger('production');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    log('info', 'ready', { correlationId: 'correlation-id' });
    log('error', 'startup_failed', { errorName: 'ExampleError' });

    const info = String(stdout.mock.calls[0]?.[0]);
    const error = String(stderr.mock.calls[0]?.[0]);
    expect(info).toContain('🚀 Bot');
    expect(info).toContain('correlationId=correlation-id');
    expect(error).toContain('❌ Startup');
    expect(error).toContain('errorName: ExampleError');
    expect(`${info}${error}`).not.toContain('\u001B[');
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

  it('formats the registered Discord events as a startup step', () => {
    const output = formatTerminalLog('success', 'events_loaded', {
      count: 3,
      events: 'clientReady, interactionCreate, messageCreate',
    }, false);

    expect(output).toContain('📡 Events     Eventos carregados');
    expect(output).toContain('count=3');
    expect(output).toContain('events=clientReady, interactionCreate, messageCreate');
  });
});
