import { describe, expect, it } from 'vitest';
import { isDiscordId, readDatabaseConfig } from '@kuruttina/database';
import { selectBotEnvironment } from '../apps/bot/src/config.js';
describe('database configuration', () => {
  const remote = 'postgresql://kuruttina_bot.abcdefghijklmnopqrst:fake@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  it('requires the active environment without fallback', () => {
    expect(() => readDatabaseConfig({ DATABASE_URL_DEVELOPMENT: remote }, 'production')).toThrow('DATABASE_URL_PRODUCTION');
  });
  it('enforces verified TLS for remote connections and bounded timeouts', () => {
    expect(readDatabaseConfig({ DATABASE_URL_PRODUCTION: remote }, 'production')).toMatchObject({
      ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 5000, statement_timeout: 5000,
    });
  });
  it.each(['?sslmode=disable', '?sslmode=no-verify', '?options=-c%20role=postgres', '#fragment'])('rejects URL overrides %s', (suffix) => {
    expect(() => readDatabaseConfig({ DATABASE_URL_DEVELOPMENT: remote + suffix }, 'development')).toThrow();
  });
  it('rejects owner credentials and local production endpoints', () => {
    expect(() => readDatabaseConfig({ DATABASE_URL_PRODUCTION: remote.replace('kuruttina_bot.', 'postgres.') }, 'production')).toThrow();
    expect(() => readDatabaseConfig({ DATABASE_URL_PRODUCTION: 'postgres://kuruttina_bot:test@localhost/postgres' }, 'production')).toThrow();
  });
  it('never includes the other environment or administrative credentials in the bot allowlist', () => {
    expect(selectBotEnvironment({ APP_ENV: 'development', DATABASE_URL_DEVELOPMENT: remote, DATABASE_URL_PRODUCTION: 'private', DATABASE_MIGRATION_URL_DEVELOPMENT: 'private' }))
      .toEqual({ APP_ENV: 'development', DATABASE_URL_DEVELOPMENT: remote });
  });
  it('validates snowflakes without precision loss', () => {
    expect(isDiscordId('1509331533348212808')).toBe(true);
    for (const id of [1509331533348212808, '18446744073709551616', '012345678901234567', '', null]) expect(isDiscordId(id)).toBe(false);
  });
});
