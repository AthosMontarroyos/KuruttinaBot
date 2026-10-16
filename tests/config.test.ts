import { describe, expect, it } from 'vitest';
import { loadConfig, selectBotEnvironment } from '../apps/bot/src/config.js';

const developmentBotId = ['123456789', '012345678'].join('');
const productionBotId = ['987654321', '098765432'].join('');
const base = {
  DATABASE_URL: 'postgresql://kuruttina_bot:test@localhost/postgres',
  APP_ENV: 'development',
  DISCORD_BOT_TOKEN: 'fake-dev-token',
  DISCORD_BOT_ID: developmentBotId,
};
describe('loadConfig', () => {
  it('loads strict boolean with safe default', () => expect(loadConfig(base).autoSyncCommands).toBe(false));
  it('selects only variables consumed by the bot', () => {
    expect(selectBotEnvironment({
      ...base,
      ASSETS_BASE_URL: 'https://assets.example.com',
      DATABASE_MIGRATION_URL: 'do-not-inherit',
      DISCORD_CLIENT_SECRET: 'do-not-inherit',
      DISCORD_PUBLIC_KEY: 'do-not-inherit',
      DISCORD_BOT_TOKEN_PRODUCTION: 'do-not-inherit',
      DATABASE_URL_DEVELOPMENT: 'do-not-inherit',
    })).toEqual(base);
  });
  it('rejects invalid target and boolean', () => { expect(() => loadConfig({ ...base, APP_ENV: 'staging' })).toThrow(); expect(() => loadConfig({ ...base, AUTO_SYNC_COMMANDS: 'yes' })).toThrow(); });
  it('rejects an empty boolean and non-canonical snowflakes', () => {
    expect(() => loadConfig({ ...base, AUTO_SYNC_COMMANDS: '' })).toThrow('AUTO_SYNC_COMMANDS');
    expect(() => loadConfig({ ...base, DISCORD_BOT_ID: '01234567890123456' })).toThrow('snowflake');
  });
  it('reads the unsuffixed credential for the active environment', () => {
    const config = loadConfig({
      ...base,
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://kuruttina_bot:test@production.example/postgres',
      DISCORD_BOT_TOKEN: 'fake-prod-token',
      DISCORD_BOT_ID: productionBotId,
    });
    expect(config.target).toBe('production');
    expect(config.activeCredential).toEqual({ token: 'fake-prod-token', expectedBotId: productionBotId });
    expect(JSON.stringify(config)).not.toContain('fake-dev-token');
  });
  it('does not read a suffixed production token in development', () => {
    const config = loadConfig({ ...base, DISCORD_BOT_TOKEN_PRODUCTION: 'fake-prod-token', DISCORD_BOT_ID_PRODUCTION: productionBotId });
    expect(config.target).toBe('development');
    expect(config.activeCredential.token).toBe(base.DISCORD_BOT_TOKEN);
    expect(JSON.stringify(config)).not.toContain('fake-prod-token');
  });
  it('requires the unsuffixed token and ignores suffixed names', () => {
    const production = {
      ...base,
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://kuruttina_bot:test@production.example/postgres',
      DISCORD_BOT_TOKEN_PRODUCTION: 'fake-prod-token',
      DISCORD_BOT_ID_PRODUCTION: productionBotId,
    };
    expect(() => loadConfig({ ...production, DISCORD_BOT_TOKEN: '' })).toThrow(
      'Missing required configuration: DISCORD_BOT_TOKEN',
    );
    expect(loadConfig(production).activeCredential.token).toBe(base.DISCORD_BOT_TOKEN);
  });
});
