import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverApps, main, MODES, runCommands } from '../scripts/run.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function capture() {
  let text = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      text += String(chunk);
      callback();
    },
  });
  return { stream, read: () => text };
}

function listedFiles(script: string): string[] {
  const prefix = 'vitest run ';
  if (!script.startsWith(prefix)) throw new Error(`unexpected test script: ${script}`);
  const args = script.slice(prefix.length).split(' ').filter(Boolean);
  const output = execFileSync(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'list', '--filesOnly', ...args,
  ], { cwd: root, encoding: 'utf8' });
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort();
}

describe('app runner', () => {
  it('discovers apps from their package.json and keeps root workspaces unchanged', async () => {
    const apps = await discoverApps();
    expect(apps.map((app) => app.name)).toEqual(['bot', 'site']);
    const rootPkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      workspaces: string[];
      scripts: Record<string, string>;
    };
    expect(rootPkg.workspaces).toEqual([
      'packages/config',
      'packages/database',
      'packages/message-templates',
    ]);
    expect(rootPkg.scripts.dev).toBe('node scripts/run.mjs dev');
    expect(rootPkg.scripts.build).toBe('node scripts/run.mjs build');
    expect(rootPkg.scripts.start).toBe('node scripts/run.mjs start');
    expect(rootPkg.scripts.test).toBe('node scripts/run.mjs test');
    expect(rootPkg.scripts.bot).toBe('node scripts/run.mjs bot');
    expect(rootPkg.scripts.site).toBe('node scripts/run.mjs site');
    expect(rootPkg.scripts['site:dev']).toBeUndefined();
    expect(rootPkg.scripts['site:build']).toBeUndefined();
    expect(rootPkg.scripts['site:start']).toBeUndefined();
    expect(rootPkg.scripts['build:all']).toBeUndefined();
    expect(rootPkg.scripts.typecheck).toContain('tsc --noEmit');
    expect(rootPkg.scripts['test:database']).toBe('vitest run tests/database.integration.test.ts');
    expect(rootPkg.scripts['deploy:commands']).toBe('node dist/apps/bot/src/deployments/deploy-central.js');
  });

  it('preserves the bot and site commands', () => {
    const bot = JSON.parse(readFileSync(new URL('../apps/bot/package.json', import.meta.url), 'utf8')) as {
      private: boolean;
      scripts: Record<string, string>;
    };
    const site = JSON.parse(readFileSync(new URL('../apps/site/package.json', import.meta.url), 'utf8')) as {
      private: boolean;
      scripts: Record<string, string>;
    };
    expect(bot.private).toBe(true);
    expect(site.private).toBe(true);
    expect(bot.scripts.dev).toBe('node --import @kuruttina/config/development --import tsx apps/bot/src/index.ts');
    expect(bot.scripts.build).toBe('node -e "require(\'node:fs\').rmSync(\'dist/apps/bot\',{recursive:true,force:true})" && tsc -p apps/bot/tsconfig.build.json');
    expect(bot.scripts.start).toBe('node dist/apps/bot/src/index.js');
    expect(site.scripts.dev).toBe('node apps/site/build.mjs && node --import @kuruttina/config/site-development dist/apps/site/index.js');
    expect(site.scripts.dev).not.toContain('doppler');
    expect(site.scripts.build).toBe('node apps/site/build.mjs');
    expect(site.scripts.start).toBe('node dist/apps/site/index.js');
  });

  it('covers the same hermetic files as one vitest run that excludes the database integration', () => {
    const bot = JSON.parse(readFileSync(new URL('../apps/bot/package.json', import.meta.url), 'utf8')) as { scripts: { test: string } };
    const site = JSON.parse(readFileSync(new URL('../apps/site/package.json', import.meta.url), 'utf8')) as { scripts: { test: string } };
    const full = listedFiles('vitest run --exclude tests/database.integration.test.ts');
    const botFiles = listedFiles(bot.scripts.test);
    const siteFiles = listedFiles(site.scripts.test);
    const union = [...new Set([...botFiles, ...siteFiles])].sort();
    expect(union).toEqual(full);
    expect(botFiles.filter((file) => siteFiles.includes(file))).toEqual([]);
    expect(full).not.toContain('tests/database.integration.test.ts');
    expect(MODES).toEqual(['dev', 'build', 'start', 'test']);
  });

  it.each([
    [[]],
    [['nope']],
    [['bot']],
    [['bot', 'nope']],
    [['nope', 'dev']],
    [['dev', 'extra']],
  ])('prints usage and exits 1 for %j', async (argv: string[]) => {
    const output = capture();
    const code = await main(argv, { stderr: output.stream });
    expect(code).toBe(1);
    expect(output.read()).toContain('Usage:');
    expect(output.read()).toContain('npm run <app> <mode>');
    expect(output.read()).toContain('bot, site');
  });

  it('runs build and test one app at a time and stops on the first failure', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'kuruttina-run-'));
    const marker = path.join(directory, 'site-ran');
    try {
      const code = await runCommands([
        { name: 'bot', command: 'node -e "process.exit(4)"' },
        { name: 'site', command: `node -e 'require("node:fs").writeFileSync(${JSON.stringify(marker)}, "x")'` },
      ], { concurrent: false });
      expect(code).toBe(4);
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('prefixes concurrent output and stops the other app when one exits non-zero', async () => {
    const output = capture();
    const code = await runCommands([
      { name: 'bot', command: 'node -e "setTimeout(() => { console.log(\'bot-fail\'); process.exit(3); }, 200)"' },
      { name: 'site', command: 'node -e "console.log(\'site-ready\'); setInterval(() => {}, 1000)"' },
    ], { concurrent: true, stdout: output.stream, stderr: output.stream });
    expect(code).toBe(3);
    expect(output.read()).toContain('[bot] bot-fail');
    expect(output.read()).toContain('[site] site-ready');
  });

  it('leaves the other app running when one exits zero', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'kuruttina-run-'));
    const marker = path.join(directory, 'bot-finished');
    const output = capture();
    try {
      const code = await runCommands([
        { name: 'site', command: 'node -e "console.log(\'site-done\'); process.exit(0)"' },
        { name: 'bot', command: `node -e 'setTimeout(() => { require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ok"); console.log("bot-done"); }, 250)'` },
      ], { concurrent: true, stdout: output.stream, stderr: output.stream });
      expect(code).toBe(0);
      expect(existsSync(marker)).toBe(true);
      expect(output.read()).toContain('[bot] bot-done');
      expect(output.read()).toContain('[site] site-done');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('stops a command when the runner receives SIGTERM', async () => {
    const source = [
      "import { runCommands } from './scripts/run.mjs';",
      "const code = await runCommands([{ name: 'bot', command: 'node -e \"setInterval(() => {}, 1000)\"' }], { concurrent: false });",
      'process.exit(code);',
    ].join('\n');
    const child = spawn(process.execPath, ['--input-type=module', '--eval', source], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      child.kill('SIGTERM');
      const code = await new Promise<number | null>((resolve) => child.on('exit', (exitCode) => resolve(exitCode)));
      expect(code).toBe(143);
    } finally {
      child.kill('SIGKILL');
    }
  }, 8_000);
});
