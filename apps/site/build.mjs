import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const siteRoot = fileURLToPath(new URL('./', import.meta.url));
const output = new URL('../../dist/apps/site/', import.meta.url);
rmSync(output, { recursive: true, force: true });

// O catálogo de comandos do site vem dos módulos do bot: regenerado a cada build, sem passo manual.
const catalog = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../../scripts/commands-catalog.mjs', import.meta.url))], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit' });
if (catalog.error || catalog.status !== 0) process.exit(catalog.status ?? 1);

const vite = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));
const client = spawnSync(process.execPath, [vite, 'build'], { cwd: siteRoot, stdio: 'inherit' });
if (client.error || client.status !== 0) process.exit(client.status ?? 1);

const compiler = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));
const server = spawnSync(process.execPath, [compiler, '-p', fileURLToPath(new URL('./tsconfig.server.json', import.meta.url))], { stdio: 'inherit' });
if (server.error || server.status !== 0) process.exit(server.status ?? 1);
