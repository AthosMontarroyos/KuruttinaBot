import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  settings: vi.fn(), close: vi.fn(), login: vi.fn(), destroy: vi.fn(),
  sync: vi.fn(), identity: vi.fn(), staffRole: vi.fn(), database: vi.fn(),
}));
vi.mock('@kuruttina/database', () => ({
  createDatabase: mocks.database,
}));
vi.mock('../apps/bot/src/config.js', () => ({
  loadConfig: () => ({
    target: 'development', database: {},
    activeCredential: { token: 'fake', expectedBotId: '123456789012345678' },
  }),
}));
vi.mock('../apps/bot/src/command-system/loadCommands.js', () => ({ loadCommands: async () => [] }));
vi.mock('../apps/bot/src/infrastructure/discord/identity.js', () => ({ verifyBotIdentity: mocks.identity }));
vi.mock('../apps/bot/src/handlers/DeploymentsHandler.js', () => ({
  DeploymentsHandler: class { run = mocks.sync; },
}));
vi.mock('../apps/bot/src/infrastructure/logging/logger.js', () => ({ configureLogger: vi.fn(), log: vi.fn() }));
vi.mock('discord.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('discord.js')>();
  return { ...actual, Client: class { once = vi.fn(); on = vi.fn(); login = mocks.login; destroy = mocks.destroy; } };
});
import { startBot } from '../apps/bot/src/bootstrap.js';
import { log } from '../apps/bot/src/infrastructure/logging/logger.js';

describe('database lifecycle at startup and shutdown', () => {
  let originalTerm: NodeJS.SignalsListener[];
  let originalInt: NodeJS.SignalsListener[];
  beforeEach(() => {
    originalTerm = process.listeners('SIGTERM');
    originalInt = process.listeners('SIGINT');
    vi.clearAllMocks();
    mocks.database.mockReturnValue({ getSettings: mocks.settings, close: mocks.close, getStaffRole: mocks.staffRole });
    mocks.settings.mockResolvedValue({ environment: 'development', devGuildId: '1422623678205657160' });
    mocks.close.mockResolvedValue(undefined);
    mocks.destroy.mockResolvedValue(undefined);
    mocks.identity.mockResolvedValue('123456789012345678');
    mocks.sync.mockResolvedValue(undefined);
    mocks.login.mockResolvedValue('fake');
  });
  afterEach(() => {
    for (const listener of process.listeners('SIGTERM')) if (!originalTerm.includes(listener)) process.off('SIGTERM', listener);
    for (const listener of process.listeners('SIGINT')) if (!originalInt.includes(listener)) process.off('SIGINT', listener);
    vi.useRealTimers();
  });
  it('closes the database and never deploys or connects Discord when settings fail', async () => {
    mocks.settings.mockRejectedValue(new Error('Database unavailable'));
    await expect(startBot('test')).rejects.toThrow('Database unavailable');
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.identity).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it('closes resources if Discord login fails', async () => {
    mocks.login.mockRejectedValue(new Error('Login failed'));
    await expect(startBot('test')).rejects.toThrow('Login failed');
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(process.listeners('SIGTERM')).toEqual(originalTerm);
  });
  it('logs safe database diagnostics with the startup correlation ID', async () => {
    const diagnostic = { operation: 'get_settings', stage: 'connect', errorCode: '28P01', reason: 'authentication_failed' };
    mocks.settings.mockImplementation(async () => {
      mocks.database.mock.calls[0]?.[2](diagnostic);
      throw new Error('private driver detail');
    });
    await expect(startBot('startup-correlation')).rejects.toThrow('private driver detail');
    expect(log).toHaveBeenCalledWith('error', 'database_connection_failed', { correlationId: 'startup-correlation', ...diagnostic });
    expect(JSON.stringify(vi.mocked(log).mock.calls)).not.toContain('private driver detail');
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.identity).not.toHaveBeenCalled();
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it('closes the pool and Discord on a signal after successful startup', async () => {
    await startBot('test');
    expect(mocks.login).toHaveBeenCalledWith('fake');
    expect(mocks.settings.mock.invocationCallOrder[0]).toBeLessThan(mocks.sync.mock.invocationCallOrder[0]!);
    const listener = process.listeners('SIGTERM').find((value) => !originalTerm.includes(value));
    expect(listener).toBeDefined();
    listener?.('SIGTERM');
    await vi.waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});
