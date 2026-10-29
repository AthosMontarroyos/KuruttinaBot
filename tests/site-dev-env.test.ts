import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

function loadSiteDevelopment(env: Record<string, string>): { appEnv: string; databaseUrl: string } {
  const stdout = execFileSync(
    process.execPath,
    ['--import', './packages/config/site-development.js', '--eval', 'process.stdout.write(JSON.stringify({ appEnv: process.env.APP_ENV ?? "", databaseUrl: process.env.DATABASE_URL ?? "" }))'],
    { cwd: root, encoding: 'utf8', env },
  );
  return JSON.parse(stdout) as { appEnv: string; databaseUrl: string };
}

describe('site development env', () => {
  const siteUrl = 'postgres://kuruttina_site:site-secret@db.example/kuruttina';
  const botUrl = 'postgres://kuruttina_bot:bot-secret@db.example/kuruttina';

  it('copia SITE_DATABASE_URL para DATABASE_URL e fixa development', () => {
    const loaded = loadSiteDevelopment({
      APP_ENV: 'production',
      DATABASE_URL: botUrl,
      SITE_DATABASE_URL: `  ${siteUrl}\r`,
    });
    expect(loaded).toEqual({ appEnv: 'development', databaseUrl: siteUrl });
    expect(JSON.stringify(loaded)).not.toContain('bot-secret');
  });

  it('preserva DATABASE_URL quando SITE_DATABASE_URL está ausente ou em branco', () => {
    expect(loadSiteDevelopment({ DATABASE_URL: botUrl }).databaseUrl).toBe(botUrl);
    expect(loadSiteDevelopment({ DATABASE_URL: botUrl, SITE_DATABASE_URL: ' \t' }).databaseUrl).toBe(botUrl);
  });

  it('o script dev do site usa o preload e não chama o Doppler', () => {
    const site = JSON.parse(readFileSync(new URL('../apps/site/package.json', import.meta.url), 'utf8')) as { scripts: { dev: string } };
    const bot = JSON.parse(readFileSync(new URL('../apps/bot/package.json', import.meta.url), 'utf8')) as { scripts: { dev: string } };
    expect(site.scripts.dev).toContain('--import @kuruttina/config/site-development');
    expect(site.scripts.dev).not.toContain('doppler');
    expect(bot.scripts.dev).toContain('--import @kuruttina/config/development');
    expect(bot.scripts.dev).not.toContain('site-development');
    expect(bot.scripts.dev).not.toContain('doppler');
  });
});
