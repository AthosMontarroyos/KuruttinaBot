import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatTerminalLog, shouldUseTerminalColors } from '../../apps/bot/src/infrastructure/terminalFormatter.ts';

const startedAt = performance.now();
const environment = process.env.APP_ENV === 'production' ? 'production' : 'development';
const colorsEnabled = shouldUseTerminalColors(environment, process.stdout.isTTY, process.env);
process.stdout.write(`${formatTerminalLog('info', 'build_started', {}, colorsEnabled)}\n`);

const tscPath = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));
const result = spawnSync(process.execPath, [tscPath, '-p', 'apps/bot/tsconfig.build.json'], {
  cwd: fileURLToPath(new URL('../../', import.meta.url)),
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write(`${formatTerminalLog('error', 'build_failed', { errorName: result.error.name }, colorsEnabled)}\n`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.stderr.write(`${formatTerminalLog('error', 'build_failed', { exitCode: result.status }, colorsEnabled)}\n`);
  process.exitCode = result.status ?? 1;
} else {
  process.stdout.write(`${formatTerminalLog('success', 'build_completed', { durationMs: Math.round(performance.now() - startedAt) }, colorsEnabled)}\n`);
}
