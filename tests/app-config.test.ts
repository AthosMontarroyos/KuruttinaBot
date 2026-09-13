import { describe, expect, it } from 'vitest';
import { loadAppConfig, loadLocalWebConfig } from '@kuruttina/config';

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
  it('defaults to localhost:3666 and supports an isolated alternate port', () => {
    expect(loadLocalWebConfig({ APP_ENV: 'development' }).origin).toBe('http://localhost:3666');
    expect(loadLocalWebConfig({ APP_ENV: 'production', PORT: '3667' }).port).toBe(3667);
  });
  it.each(['', '0', '65536', '-1', '3.5', '3666junk'])('rejects invalid port %s', (PORT) => {
    expect(() => loadLocalWebConfig({ APP_ENV: 'development', PORT })).toThrow('PORT');
  });
});
