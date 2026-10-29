// @ts-nocheck
// Runs dev, build, start, and test for directories under apps/.
// Those apps are not npm workspaces: install and the lockfile stay at the
// repo root, and each command runs here with root node_modules/.bin on PATH.
// `npm run bot dev` works because the root package declares `bot` and npm
// appends the extra positional argument. A future app is included in
// `npm run <mode>` as soon as apps/<name>/package.json defines that script.
// `npm run <name> <mode>` still needs a root script of that name.

import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** @param {unknown} error */
function isEnoent(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

export const MODES = Object.freeze(['dev', 'build', 'start', 'test']);
const CONCURRENT = new Set(['dev', 'start']);
const KILL_GRACE_MS = 5_000;

export async function discoverApps(appsDirectory = path.join(root, 'apps')) {
  const entries = await readdir(appsDirectory, { withFileTypes: true });
  const apps = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(appsDirectory, entry.name, 'package.json');
    let raw;
    try {
      raw = await readFile(manifestPath, 'utf8');
    } catch (error) {
      if (isEnoent(error)) continue;
      throw error;
    }
    const manifest = JSON.parse(raw);
    const scripts = manifest.scripts && typeof manifest.scripts === 'object' ? manifest.scripts : {};
    apps.push({ name: entry.name, scripts });
  }
  apps.sort((left, right) => left.name.localeCompare(right.name, 'en'));
  return apps;
}

export function usageText(appNames) {
  const apps = appNames.length > 0 ? appNames.join(', ') : '(none)';
  return [
    'Usage:',
    '  npm run <mode>',
    '  npm run <app> <mode>',
    '',
    `Modes: ${MODES.join(', ')}`,
    `Apps: ${apps}`,
    '',
  ].join('\n');
}

export function parseInvocation(argv, appNames) {
  const names = new Set(appNames);
  if (argv.length === 1 && MODES.includes(argv[0])) return { type: 'all', mode: argv[0] };
  if (argv.length === 2 && names.has(argv[0]) && MODES.includes(argv[1])) {
    return { type: 'one', app: argv[0], mode: argv[1] };
  }
  return { type: 'usage' };
}

function commandEnv(cwd) {
  const env = { ...process.env };
  const bin = path.join(cwd, 'node_modules', '.bin');
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  const current = env[pathKey];
  env[pathKey] = current ? `${bin}${path.delimiter}${current}` : bin;
  return env;
}

function signalTree(child, signal) {
  if (child.pid == null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (!error || error.code !== 'ESRCH') {
      try {
        child.kill(signal);
      } catch {
        // The process group already exited.
      }
    }
  }
}

function killTree(child) {
  signalTree(child, 'SIGTERM');
  const timer = setTimeout(() => signalTree(child, 'SIGKILL'), KILL_GRACE_MS);
  timer.unref?.();
  child.once('exit', () => clearTimeout(timer));
}

function prefixStream(stream, output, name) {
  if (!stream) return;
  let pending = '';
  const writeLine = (line) => {
    output.write(`[${name}] ${line}\n`);
  };
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) writeLine(line);
  });
  stream.on('end', () => {
    if (pending.length > 0) writeLine(pending);
  });
}

function spawnCommand(command, { cwd, pipe }) {
  return spawn(command, {
    cwd,
    env: commandEnv(cwd),
    shell: true,
    detached: process.platform !== 'win32',
    windowsHide: true,
    stdio: pipe ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function runOne(entry, { cwd }) {
  return new Promise((resolve) => {
    let child;
    let settled = false;
    let interrupted = 0;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      process.off('SIGINT', onInt);
      process.off('SIGTERM', onTerm);
      resolve(code);
    };
    const onInt = () => {
      interrupted = 130;
      if (child) killTree(child);
      else finish(130);
    };
    const onTerm = () => {
      interrupted = interrupted || 143;
      if (child) killTree(child);
      else finish(143);
    };
    process.on('SIGINT', onInt);
    process.on('SIGTERM', onTerm);
    try {
      child = spawnCommand(entry.command, { cwd, pipe: false });
    } catch {
      finish(1);
      return;
    }
    child.on('error', () => finish(interrupted || 1));
    child.on('exit', (code) => {
      if (interrupted) finish(interrupted);
      else if (code === 0) finish(0);
      else finish(code ?? 1);
    });
  });
}

function runTogether(entries, { cwd, stdout, stderr }) {
  return new Promise((resolve) => {
    const children = entries.map((entry) => {
      const child = spawnCommand(entry.command, { cwd, pipe: true });
      prefixStream(child.stdout, stdout, entry.name);
      prefixStream(child.stderr, stderr, entry.name);
      return { child, done: false };
    });
    let remaining = children.length;
    let failure = 0;
    let interrupted = 0;
    let stopping = false;
    const stop = (signal) => {
      if (stopping) return;
      stopping = true;
      if (signal === 'SIGINT') interrupted = 130;
      else if (signal === 'SIGTERM') interrupted = interrupted || 143;
      for (const item of children) {
        if (!item.done) killTree(item.child);
      }
    };
    const onInt = () => stop('SIGINT');
    const onTerm = () => stop('SIGTERM');
    process.on('SIGINT', onInt);
    process.on('SIGTERM', onTerm);
    const finish = () => {
      if (remaining !== 0) return;
      process.off('SIGINT', onInt);
      process.off('SIGTERM', onTerm);
      resolve(interrupted || failure || 0);
    };
    for (const item of children) {
      const done = (code) => {
        if (item.done) return;
        item.done = true;
        remaining -= 1;
        if (!stopping && code !== 0) {
          failure = failure || code || 1;
          stop();
        }
        finish();
      };
      item.child.on('error', () => done(1));
      item.child.on('exit', (code) => {
        if (code === 0) done(0);
        else done(code ?? 1);
      });
    }
  });
}

export async function runCommands(entries, options = {}) {
  const cwd = options.cwd ?? root;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  if (entries.length === 0) return 0;
  const concurrent = options.concurrent === true && entries.length > 1;
  if (!concurrent) {
    for (const entry of entries) {
      const code = await runOne(entry, { cwd });
      if (code !== 0) return code;
    }
    return 0;
  }
  return runTogether(entries, { cwd, stdout, stderr });
}

function scriptFor(app, mode) {
  const command = app.scripts[mode];
  return typeof command === 'string' && command.trim() !== '' ? command : null;
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const stderr = options.stderr ?? process.stderr;
  const apps = await discoverApps(options.appsDirectory);
  const names = apps.map((app) => app.name);
  const parsed = parseInvocation(argv, names);
  if (parsed.type === 'usage') {
    stderr.write(usageText(names));
    return 1;
  }
  const selected = parsed.type === 'all' ? apps : apps.filter((app) => app.name === parsed.app);
  if (selected.length === 0 || selected.some((app) => scriptFor(app, parsed.mode) == null)) {
    stderr.write(usageText(names));
    return 1;
  }
  const entries = selected.map((app) => ({ name: app.name, command: scriptFor(app, parsed.mode) }));
  const concurrent = parsed.type === 'all' && CONCURRENT.has(parsed.mode);
  return runCommands(entries, {
    concurrent,
    cwd: options.cwd,
    stdout: options.stdout,
    stderr,
  });
}

const entry = process.argv[1];
if (entry && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
