import { describe, expect, it } from 'vitest';
import { loadConfig, selectBotEnvironment } from '../apps/bot/src/config.js';

const developmentBotId = ['123456789', '012345678'].join('');
const productionBotId = ['987654321', '098765432'].join('');
const base = { APP_ENV: 'development', DISCORD_BOT_TOKEN_DEVELOPMENT: 'fake-dev-token', DISCORD_BOT_TOKEN_PRODUCTION: 'fake-prod-token', DISCORD_BOT_ID_DEVELOPMENT: developmentBotId, DISCORD_BOT_ID_PRODUCTION: productionBotId };
describe('loadConfig', () => {
  it('loads strict boolean with safe default', () => expect(loadConfig(base).autoSyncCommands).toBe(false));
  it('selects only variables consumed by the bot', () => {
    expect(selectBotEnvironment({
      ...base,
      ASSETS_BASE_URL: 'https://assets.example.com',
      CLOUDFLARE_TUNNEL_TOKEN_DEVELOPMENT: 'do-not-inherit',
      DISCORD_CLIENT_SECRET_DEVELOPMENT: 'do-not-inherit',
    })).toEqual(base);
  });
  it('rejects invalid target and boolean', () => { expect(() => loadConfig({ ...base, APP_ENV: 'staging' })).toThrow(); expect(() => loadConfig({ ...base, AUTO_SYNC_COMMANDS: 'yes' })).toThrow(); });
  it('rejects an empty boolean and non-canonical snowflakes', () => {
    expect(() => loadConfig({ ...base, AUTO_SYNC_COMMANDS: '' })).toThrow('AUTO_SYNC_COMMANDS');
    expect(() => loadConfig({ ...base, DISCORD_BOT_ID_DEVELOPMENT: '01234567890123456' })).toThrow('snowflake');
  });
  it('selects the expected bot identity for production', () => {
    const config = loadConfig({ ...base, APP_ENV: 'production' });
    expect(config.activeCredential.expectedBotId).toBe(base.DISCORD_BOT_ID_PRODUCTION);
    expect(config.credentials.development.token).toBe(base.DISCORD_BOT_TOKEN_DEVELOPMENT);
  });
  it('requires both credentials without falling back to the active one', () => {
    expect(() => loadConfig({ ...base, DISCORD_BOT_TOKEN_PRODUCTION: '' })).toThrow(
      'Missing required configuration: DISCORD_BOT_TOKEN_PRODUCTION',
    );
  });
});
