import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@kuruttina/database';
import { formatTerminalLog } from '../apps/bot/src/infrastructure/logging/terminalFormatter.js';

const mocks = vi.hoisted(() => ({ connect: vi.fn(), query: vi.fn(), release: vi.fn(), on: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({ default: { Pool: class {
  connect = mocks.connect;
  on = mocks.on;
  end = mocks.end;
} } }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  mocks.query.mockResolvedValue({ rows: [{ dev_guild_id: '1422623678205657160', environment: 'production' }] });
});

describe('safe database diagnostics', () => {
  it.each([
    ['SELF_SIGNED_CERT_IN_CHAIN', 'tls_untrusted_certificate'],
    ['ERR_OSSL_PEM_NO_START_LINE', 'tls_invalid_ca'],
    ['28P01', 'authentication_failed'],
    ['ENOTFOUND', 'dns_lookup_failed'],
    ['ENETUNREACH', 'network_unreachable'],
    ['ECONNREFUSED', 'connection_refused'],
    ['ETIMEDOUT', 'connection_timeout'],
  ])('reports connection failure %s without logging driver data', async (code, reason) => {
    const error = Object.assign(new Error('postgres://user:secret-password@private-host/database'), {
      code, detail: 'secret-token', query: 'private SQL', password: 'secret-password',
    });
    mocks.connect.mockRejectedValue(error);
    const report = vi.fn();
    const database = createDatabase({}, 'production', report);
    try {
      await expect(database.getSettings()).rejects.toBe(error);
      expect(report).toHaveBeenCalledExactlyOnceWith({ operation: 'get_settings', stage: 'connect', errorCode: code, reason });
      const output = formatTerminalLog('error', 'database_connection_failed', { correlationId: 'test', ...report.mock.calls[0]?.[0] }, false);
      expect(output).toContain('❌ Database');
      expect(output).toContain('Falha no acesso ao banco');
      expect(output).toContain(`errorCode: ${code}`);
      for (const secret of ['postgres://', 'secret-password', 'secret-token', 'private-host', 'private SQL']) expect(output).not.toContain(secret);
      expect(mocks.release).not.toHaveBeenCalled();
    } finally { await database.close(); }
  });

  it.each([
    'timeout exceeded when trying to connect',
    'Connection terminated due to connection timeout',
  ])('recognizes the pg timeout without a driver code: %s', async (message) => {
    mocks.connect.mockRejectedValue(new Error(message));
    const report = vi.fn();
    const database = createDatabase({}, 'production', report);
    try {
      await expect(database.getSettings()).rejects.toThrow(message);
      expect(report).toHaveBeenCalledExactlyOnceWith({ operation: 'get_settings', stage: 'connect', errorCode: 'CONNECTION_TIMEOUT', reason: 'connection_timeout' });
    } finally { await database.close(); }
  });

  it.each([new Error('secret-message'), { code: 'secret-code', message: 'secret-message' }, 'secret-value', null])(
    'omits unrecognized error data (%j)', async (error) => {
      mocks.connect.mockRejectedValue(error);
      const report = vi.fn();
      const database = createDatabase({}, 'production', report);
      try {
        await expect(database.getSettings()).rejects.toBe(error);
        expect(report).toHaveBeenCalledExactlyOnceWith({ operation: 'get_settings', stage: 'connect', errorCode: 'UNKNOWN', reason: 'unclassified_database_error' });
      } finally { await database.close(); }
    },
  );

  it.each([
    ['42501', 'insufficient_privilege'],
    ['42P01', 'table_not_found'],
    ['57014', 'query_canceled_or_timed_out'],
  ])('distinguishes a query failure %s and discards the failed connection', async (code, reason) => {
    const error = Object.assign(new Error('sensitive query detail'), { code });
    mocks.query.mockRejectedValue(error);
    const report = vi.fn();
    const database = createDatabase({}, 'production', report);
    try {
      await expect(database.getSettings()).rejects.toBe(error);
      expect(report).toHaveBeenCalledExactlyOnceWith({ operation: 'get_settings', stage: 'query', errorCode: code, reason });
      expect(mocks.release).toHaveBeenCalledExactlyOnceWith(true);
    } finally { await database.close(); }
  });

  it.each([
    [[], 'SETTINGS_MISSING', 'settings_missing'],
    [[{ dev_guild_id: 'invalid', environment: 'production' }], 'SETTINGS_INVALID', 'settings_invalid'],
    [[{ dev_guild_id: '1422623678205657160', environment: 'development' }], 'ENVIRONMENT_MISMATCH', 'environment_mismatch'],
  ])('distinguishes invalid settings (%j)', async (rows, errorCode, reason) => {
    mocks.query.mockResolvedValue({ rows });
    const report = vi.fn();
    const database = createDatabase({}, 'production', report);
    try {
      await expect(database.getSettings()).rejects.toThrow('Invalid database settings or environment');
      expect(report).toHaveBeenCalledExactlyOnceWith({ operation: 'get_settings', stage: 'validate_settings', errorCode, reason });
      expect(mocks.release).toHaveBeenCalledExactlyOnceWith(true);
    } finally { await database.close(); }
  });

  it('reports idle pool errors without exposing the error or client', async () => {
    const report = vi.fn();
    const database = createDatabase({}, 'production', report);
    try {
      const listener = mocks.on.mock.calls.find(([event]) => event === 'error')?.[1];
      expect(listener).toBeTypeOf('function');
      listener(Object.assign(new Error('secret'), { code: 'ECONNRESET' }), { password: 'secret' });
      expect(report).toHaveBeenCalledExactlyOnceWith({ operation: 'pool', stage: 'idle', errorCode: 'ECONNRESET', reason: 'connection_lost' });
    } finally { await database.close(); }
  });

  it('identifies staff operations and still rolls back on failure', async () => {
    const error = Object.assign(new Error('secret'), { code: '42501' });
    mocks.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(error).mockResolvedValueOnce({ rows: [] });
    const report = vi.fn();
    const database = createDatabase({}, 'production', report);
    try {
      await expect(database.getStaffRole('666948364507545600', '1422623678205657160')).rejects.toBe(error);
      expect(report).toHaveBeenCalledExactlyOnceWith({ operation: 'get_staff_role', stage: 'query', errorCode: '42501', reason: 'insufficient_privilege' });
      expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(mocks.release).toHaveBeenCalledExactlyOnceWith(true);
    } finally { await database.close(); }
  });

  it('keeps successful settings reads silent and releases the connection', async () => {
    const report = vi.fn();
    const database = createDatabase({}, 'production', report);
    try {
      await expect(database.getSettings()).resolves.toEqual({ devGuildId: '1422623678205657160', environment: 'production' });
      expect(report).not.toHaveBeenCalled();
      expect(mocks.release).toHaveBeenCalledExactlyOnceWith();
    } finally { await database.close(); }
  });
});
