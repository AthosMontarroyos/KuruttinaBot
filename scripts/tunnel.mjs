import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { loadLocalWebConfig } from '@kuruttina/config';

try {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const target = args.find((arg) => arg !== '--check');
  if (args.length > (target ? 1 : 0) + (check ? 1 : 0)) throw new Error('Usage: tunnel.mjs [development|production] [--check]');
  if (target !== undefined) process.env.APP_ENV = target;
  const config = loadLocalWebConfig();
  const tunnels = JSON.parse(readFileSync(new URL('../infra/cloudflare/tunnels.json', import.meta.url), 'utf8'));
  const tunnel = tunnels[config.appEnv];
  console.log(JSON.stringify({ appEnv: config.appEnv, ...tunnel, origin: config.origin, configSource: 'cloudflare' }));
  if (!check) {
    const key = `CLOUDFLARE_TUNNEL_TOKEN_${config.appEnv.toUpperCase()}`;
    const tokenValue = process.env[key];
    if (!tokenValue) throw new Error(`Missing required configuration: ${key}`);
    let token;
    try { token = JSON.parse(Buffer.from(tokenValue, 'base64').toString('utf8')); }
    catch { throw new Error(`Invalid tunnel token in ${key}`); }
    if (token.t !== tunnel.id) throw new Error('Tunnel token does not match APP_ENV');
    // The connector never inherits Discord or unrelated application credentials.
    const env = {};
    for (const name of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'HOME', 'USERPROFILE', 'TEMP', 'TMP']) {
      if (process.env[name] !== undefined) env[name] = process.env[name];
    }
    env.TUNNEL_TOKEN = tokenValue;
    const child = spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run'], { env, stdio: 'inherit', windowsHide: true });
    child.on('error', () => { console.error('Unable to start cloudflared; check installation'); process.exitCode = 1; });
    child.on('exit', (code) => { process.exitCode = code ?? 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
