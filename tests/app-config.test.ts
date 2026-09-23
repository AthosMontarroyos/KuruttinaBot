import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '@kuruttina/config';

describe('global environment', () => {
  it.each(['development', 'production'])('selects %s explicitly', (appEnv) => {
    expect(loadAppConfig({ APP_ENV: appEnv }).appEnv).toBe(appEnv);
  });
  it.each([undefined, '', 'staging', 'Production', ' production '])('rejects invalid mode %s', (APP_ENV) => {
    expect(() => loadAppConfig({ APP_ENV, NODE_ENV: 'production' })).toThrow('APP_ENV');
  });
  it('rejects the legacy selector even alongside APP_ENV', () => {
    expect(() => loadAppConfig({ BOT_TARGET: 'production', APP_ENV: 'development' })).toThrow('BOT_TARGET');
  });
});
