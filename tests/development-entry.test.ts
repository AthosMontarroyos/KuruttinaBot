import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('native development preload', () => {
  it.each([undefined, 'production'])('selects development with inherited APP_ENV=%s', (appEnv) => {
    const env = { ...process.env };
    delete env.APP_ENV;
    if (appEnv !== undefined) env.APP_ENV = appEnv;
    const result = execFileSync(process.execPath, [
      '--import', '@kuruttina/config/development', '--input-type=module',
      '--eval', "import { loadAppConfig } from '@kuruttina/config'; process.stdout.write(loadAppConfig().appEnv);",
    ], { env, encoding: 'utf8' });
    expect(result).toBe('development');
  });
});
