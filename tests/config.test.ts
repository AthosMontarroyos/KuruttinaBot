import { describe, expect, it } from 'vitest';
import { loadConfig } from '../apps/bot/src/config.js';

const developmentBotId = ['123456789', '012345678'].join('');
const productionBotId = ['987654321', '098765432'].join('');
const base = { BOT_TARGET: 'development', DISCORD_BOT_TOKEN_DEVELOPMENT: 'fake-dev-token', DISCORD_BOT_TOKEN_PRODUCTION: 'fake-prod-token', DISCORD_BOT_ID_DEVELOPMENT: developmentBotId, DISCORD_BOT_ID_PRODUCTION: productionBotId, ASSETS_BASE_URL: 'https://assets.example.com/' };
describe('loadConfig', () => {
  it('loads strict boolean with safe default', () => expect(loadConfig(base).autoSyncCommands).toBe(false));
  it('rejects invalid target and boolean', () => { expect(() => loadConfig({ ...base, BOT_TARGET: 'staging' })).toThrow(); expect(() => loadConfig({ ...base, AUTO_SYNC_COMMANDS: 'yes' })).toThrow(); });
  it('selects the expected bot identity for production', () => {
    const config = loadConfig({ ...base, BOT_TARGET: 'production' });
    expect(config.activeCredential.expectedBotId).toBe(base.DISCORD_BOT_ID_PRODUCTION);
    expect(config.credentials.development.token).toBe(base.DISCORD_BOT_TOKEN_DEVELOPMENT);
  });
  it('requires both credentials without falling back to the active one', () => {
    expect(() => loadConfig({ ...base, DISCORD_BOT_TOKEN_PRODUCTION: '' })).toThrow(
      'Missing required configuration: DISCORD_BOT_TOKEN_PRODUCTION',
    );
  });
  it('normalizes and validates the public assets URL', () => {
    expect(loadConfig(base).assetsBaseUrl).toBe('https://assets.example.com');
    expect(() => loadConfig({ ...base, ASSETS_BASE_URL: 'http://assets.example.com' })).toThrow('valid HTTPS URL');
    expect(() => loadConfig({ ...base, ASSETS_BASE_URL: 'https://user:pass@assets.example.com' })).toThrow(
      'without credentials',
    );
  });
});
