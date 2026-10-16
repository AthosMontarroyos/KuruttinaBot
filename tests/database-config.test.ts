import { rootCertificates, createSecureContext } from 'node:tls';
import { describe, expect, it } from 'vitest';
import { isDiscordId, readDatabaseConfig } from '@kuruttina/database';
import { selectBotEnvironment } from '../apps/bot/src/config.js';
describe('database configuration', () => {
  const remote = 'postgresql://kuruttina_bot.abcdefghijklmnopqrst:fake@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  const certificate = rootCertificates[0]!;
  it.each([
    certificate,
    "'" + certificate.replace(/\n/gu, ' ') + "'",
    '"' + certificate.replace(/\n/gu, '\\n') + '"',
    certificate.replace(/\n/gu, '\r\n'),
    certificate + '\n' + certificate,
  ])('normalizes supported PEM formats without disabling verification %#', (value) => {
    const { ssl } = readDatabaseConfig({ DATABASE_URL: remote, DATABASE_CA: value }, 'production');
    expect(ssl).toMatchObject({ rejectUnauthorized: true });
    if (!ssl) throw new Error('TLS required');
    expect(() => createSecureContext(ssl)).not.toThrow();
    expect(ssl.ca).toContain('-----BEGIN CERTIFICATE-----\n');
  });
  it.each(['garbage', '-----BEGIN CERTIFICATE-----AAAA-----END CERTIFICATE-----', certificate + 'trailing', "'" + certificate, 'x'.repeat(65537)])('rejects invalid certificates without exposing their value %#', (value) => {
    expect(() => readDatabaseConfig({ DATABASE_URL: remote, DATABASE_CA: value }, 'production')).toThrow('Invalid DATABASE_CA');
  });
  it('reads the unsuffixed URL and still rejects a local database for production', () => {
    expect(() => readDatabaseConfig({ DATABASE_URL_DEVELOPMENT: remote }, 'production')).toThrow('DATABASE_URL');
    expect(() => readDatabaseConfig({ DATABASE_URL: 'postgres://kuruttina_bot:test@localhost/postgres' }, 'production')).toThrow('DATABASE_URL');
    expect(readDatabaseConfig({ DATABASE_URL: remote }, 'development').host).toBe('aws-1-sa-east-1.pooler.supabase.com');
  });
  it('enforces verified TLS for remote connections and bounded timeouts', () => {
    expect(readDatabaseConfig({ DATABASE_URL: remote }, 'production')).toMatchObject({
      ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 5000, statement_timeout: 5000,
    });
  });
  it.each(['?sslmode=disable', '?sslmode=no-verify', '?options=-c%20role=postgres', '#fragment'])('rejects URL overrides %s', (suffix) => {
    expect(() => readDatabaseConfig({ DATABASE_URL: remote + suffix }, 'development')).toThrow();
  });
  it('rejects owner credentials and local production endpoints', () => {
    expect(() => readDatabaseConfig({ DATABASE_URL: remote.replace('kuruttina_bot.', 'postgres.') }, 'production')).toThrow();
    expect(() => readDatabaseConfig({ DATABASE_URL: 'postgres://kuruttina_bot:test@localhost/postgres' }, 'production')).toThrow();
  });
  it('reads the migration URL without falling back to the runtime URL', () => {
    expect(() => readDatabaseConfig({ DATABASE_URL: remote }, 'production', 'migration')).toThrow('DATABASE_MIGRATION_URL');
    expect(readDatabaseConfig({ DATABASE_MIGRATION_URL: remote, DATABASE_CA: certificate }, 'production', 'migration')).toMatchObject({
      user: 'kuruttina_bot.abcdefghijklmnopqrst',
      ssl: { rejectUnauthorized: true },
    });
  });
  it('never includes administrative credentials in the bot allowlist', () => {
    expect(selectBotEnvironment({
      APP_ENV: 'development',
      DATABASE_URL: remote,
      DATABASE_MIGRATION_URL: 'private',
      DISCORD_CLIENT_SECRET: 'private',
      DATABASE_URL_PRODUCTION: 'private',
    })).toEqual({ APP_ENV: 'development', DATABASE_URL: remote });
  });
  it('validates snowflakes without precision loss', () => {
    expect(isDiscordId('1509331533348212808')).toBe(true);
    for (const id of [1509331533348212808, '18446744073709551616', '012345678901234567', '', null]) expect(isDiscordId(id)).toBe(false);
  });
});
