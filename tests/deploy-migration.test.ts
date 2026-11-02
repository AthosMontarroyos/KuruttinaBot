import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const deployWorkflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');

function migrationFunction(): string {
  const match = deployWorkflow.match(/ {10}migration_configured\(\) \{[\s\S]*?\n {10}\}/);
  if (!match) {
    throw new Error('migration_configured não está em deploy.yml');
  }
  return match[0].replace(/^ {10}/gm, '');
}

function run(mode: string, value = ''): string {
  const root = mkdtempSync(path.join(tmpdir(), 'migration-doppler-'));
  const doppler = path.join(root, 'doppler');
  writeFileSync(
    doppler,
    `#!/bin/bash
set -euo pipefail
joined=" $* "
if [[ "\${joined}" != *" --no-exit-on-missing-secret "* ]]; then
  echo "flag ausente" >&2
  exit 1
fi
case "\${DOPPLER_FAKE_MODE}" in
  missing)
    exit 0
    ;;
  empty)
    printf '\\n'
    ;;
  blank)
    printf ' \\t \\r\\n'
    ;;
  present)
    printf '%s\\n' "\${DOPPLER_FAKE_VALUE}"
    ;;
  down)
    echo "doppler indisponivel" >&2
    exit 1
    ;;
  *)
    echo "modo invalido" >&2
    exit 1
    ;;
esac
`,
  );
  chmodSync(doppler, 0o755);
  const script = path.join(root, 'check.sh');
  writeFileSync(
    script,
    `#!/bin/bash
set -euo pipefail
export PATH="$(dirname "$0"):$PATH"
${migrationFunction()}
status=0
migration_configured || status=$?
printf 'STATUS=%s\\n' "\${status}"
`,
  );
  chmodSync(script, 0o755);
  return execFileSync('bash', [script], {
    encoding: 'utf8',
    env: {
      PATH: process.platform === 'win32' ? process.env.PATH : '/usr/bin:/bin',
      DOPPLER_FAKE_MODE: mode,
      DOPPLER_FAKE_VALUE: value,
      HOME: root,
    },
  });
}

describe('migration_configured', () => {
  const secret = 'postgres://migrator:s3cret@db.example/kuruttina';

  it('pula quando o segredo não existe', () => {
    expect(run('missing')).toBe('STATUS=1\n');
  });

  it('pula quando o valor é vazio ou só espaço', () => {
    expect(run('empty')).toBe('STATUS=1\n');
    expect(run('blank')).toBe('STATUS=1\n');
  });

  it('pede migration quando há valor e não imprime o segredo', () => {
    const stdout = run('present', `  ${secret}\r`);
    expect(stdout).toBe('STATUS=0\n');
    expect(stdout).not.toContain('s3cret');
  });

  it('falha quando o Doppler não responde', () => {
    expect(run('down')).toBe('STATUS=2\n');
  });

  it('mantém a checagem de Doppler antes de alterar o checkout', () => {
    const preflight = deployWorkflow.indexOf('doppler secrets --only-names >/dev/null');
    const checkout = deployWorkflow.indexOf('git checkout --detach "${resolved}"');
    expect(preflight).toBeGreaterThan(-1);
    expect(checkout).toBeGreaterThan(preflight);
  });
});

function runtimeFunction(): string {
  const match = deployWorkflow.match(/ {10}require_runtime_databases\(\) \{[\s\S]*?\n {10}\}/);
  if (!match) {
    throw new Error('require_runtime_databases não está em deploy.yml');
  }
  return match[0].replace(/^ {10}/gm, '');
}

function serviceBlock(raw: string, name: string): string {
  const source = raw.replace(/\r\n/gu, '\n');
  const marker = `\n  ${name}:\n`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`serviço ${name} ausente`);
  const rest = source.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z]/u);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

function runRuntime(siteMode: string, botMode: string, siteValue = '', botValue = '', down = false): string {
  const root = mkdtempSync(path.join(tmpdir(), 'runtime-doppler-'));
  const doppler = path.join(root, 'doppler');
  writeFileSync(
    doppler,
    `#!/bin/bash
set -euo pipefail
if [ "\${1:-}" != "run" ] || [ "\${2:-}" != "--" ]; then
  echo "doppler run esperado" >&2
  exit 1
fi
if [ "\${DOPPLER_DOWN:-}" = "1" ]; then
  echo "doppler indisponivel" >&2
  exit 1
fi
script="\$5"
varname="\$7"
case "\${varname}" in
  SITE_DATABASE_URL) mode="\${DOPPLER_SITE}" ;;
  DATABASE_URL) mode="\${DOPPLER_BOT}" ;;
  *) echo "nome inesperado" >&2; exit 1 ;;
esac
case "\${mode}" in
  unset) unset "\${varname}" ;;
  empty) printf -v "\${varname}" '%s' '' ;;
  blank) printf -v "\${varname}" ' \\t \\r' ;;
  value)
    if [ "\${varname}" = "SITE_DATABASE_URL" ]; then
      printf -v "\${varname}" '%s' "\${DOPPLER_SITE_VALUE}"
    else
      printf -v "\${varname}" '%s' "\${DOPPLER_BOT_VALUE}"
    fi
    ;;
  *) echo "modo invalido" >&2; exit 1 ;;
esac
export "\${varname}"
exec bash -c "\${script}" bash "\${varname}"
`,
  );
  chmodSync(doppler, 0o755);
  const script = path.join(root, 'check.sh');
  writeFileSync(
    script,
    `#!/bin/bash
set -euo pipefail
export PATH="$(dirname "$0"):$PATH"
${runtimeFunction()}
status=0
require_runtime_databases || status=$?
printf 'STATUS=%s\\n' "\${status}"
`,
  );
  chmodSync(script, 0o755);
  return execFileSync('bash', [script], {
    encoding: 'utf8',
    env: {
      PATH: process.platform === 'win32' ? process.env.PATH : '/usr/bin:/bin',
      DOPPLER_DOWN: down ? '1' : '',
      DOPPLER_SITE: siteMode,
      DOPPLER_BOT: botMode,
      DOPPLER_SITE_VALUE: siteValue,
      DOPPLER_BOT_VALUE: botValue,
      HOME: root,
    },
  });
}

describe('require_runtime_databases', () => {
  const siteSecret = 'postgres://kuruttina_site:s3cret-site@db.example/kuruttina';
  const botSecret = 'postgres://kuruttina_bot:s3cret-bot@db.example/kuruttina';

  it('aceita os dois segredos preenchidos e não imprime os valores', () => {
    const stdout = runRuntime('value', 'value', `  ${siteSecret}\r`, botSecret);
    expect(stdout).toBe('STATUS=0\n');
    expect(stdout).not.toContain('s3cret');
  });

  it('falha com o nome quando um segredo está ausente, vazio ou só espaço', () => {
    expect(runRuntime('unset', 'value', '', botSecret)).toContain('Segredos ausentes ou vazios: SITE_DATABASE_URL.');
    expect(runRuntime('empty', 'value', '', botSecret)).toContain('STATUS=1\n');
    expect(runRuntime('value', 'blank', siteSecret, ' \t \r')).toContain('Segredos ausentes ou vazios: DATABASE_URL.');
    for (const stdout of [
      runRuntime('unset', 'empty'),
      runRuntime('blank', 'blank', ' \t ', ' \t '),
    ]) {
      expect(stdout).toContain('SITE_DATABASE_URL');
      expect(stdout).toContain('DATABASE_URL');
      expect(stdout).not.toContain('s3cret');
      expect(stdout).toContain('STATUS=1\n');
    }
  });

  it('falha quando o Doppler não responde, sem imprimir valor', () => {
    const stdout = runRuntime('value', 'value', siteSecret, botSecret, true);
    expect(stdout).toContain('Não foi possível ler SITE_DATABASE_URL.');
    expect(stdout).toContain('STATUS=2\n');
    expect(stdout).not.toContain('s3cret');
  });

  it('confere os segredos de runtime antes do build e mantém a migration opcional', () => {
    const call = deployWorkflow.indexOf('if ! require_runtime_databases; then');
    const build = deployWorkflow.indexOf('if ! doppler run -- docker compose build; then', call);
    expect(call).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(call);
    expect(deployWorkflow).toContain('Migration ignorada: DATABASE_MIGRATION_URL ausente ou vazio.');
  });

  it('imprime os logs do site e do bot antes do rollback da espera de saúde', () => {
    const healthFail = deployWorkflow.slice(deployWorkflow.indexOf('if [ "${ready}" -ne 1 ]'));
    const logsAt = healthFail.indexOf('doppler run -- docker compose logs site bot --tail 100');
    const rollbackAt = healthFail.indexOf('rollback_activation');
    expect(logsAt).toBeGreaterThan(-1);
    expect(rollbackAt).toBeGreaterThan(logsAt);
  });
});

describe('compose database env', () => {
  it('entrega SITE_DATABASE_URL só ao site, nos dois Composes', () => {
    for (const file of ['../compose.yaml', '../compose.dev.yaml']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      const bot = serviceBlock(source, 'bot');
      const site = serviceBlock(source, 'site');
      expect(bot).toContain('DATABASE_URL: ${DATABASE_URL:-}');
      expect(bot).toContain('DATABASE_CA: ${DATABASE_CA:-}');
      expect(bot).not.toContain('SITE_DATABASE_URL');
      expect(site).toContain('DATABASE_URL: ${SITE_DATABASE_URL:-}');
      expect(site).toContain('DATABASE_CA: ${DATABASE_CA:-}');
      expect(site).not.toContain('DATABASE_URL: ${DATABASE_URL:-}');
    }
  });

  it('entrega ao site nos dois Composes o token do bot e o par do OAuth (id e client secret)', () => {
    const production = readFileSync(new URL('../compose.yaml', import.meta.url), 'utf8');
    const development = readFileSync(new URL('../compose.dev.yaml', import.meta.url), 'utf8');
    const devSite = serviceBlock(development, 'site');
    const devBot = serviceBlock(development, 'bot');
    expect(production).not.toContain('OWNER_ID');
    expect(development).not.toContain('OWNER_ID');
    expect(devSite).toContain('DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN:-}');
    expect(devSite).toContain('DISCORD_BOT_ID: ${DISCORD_BOT_ID:-}');
    expect(devSite).toContain('DISCORD_CLIENT_SECRET: ${DISCORD_CLIENT_SECRET:-}');
    expect(devBot).not.toContain('DISCORD_CLIENT_SECRET');
    expect(devBot).toContain('DISCORD_BOT_ID: ${DISCORD_BOT_ID:-}');
    expect(devBot).toContain('DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN:-}');
    // Decisão aprovada em 29 de outubro de 2026 (docs/decisions/site-holds-bot-token.md): o site de produção também recebe o token.
    expect(serviceBlock(production, 'site')).toContain('DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN:-}');
    expect(serviceBlock(production, 'site')).toContain('DISCORD_BOT_ID: ${DISCORD_BOT_ID:-}');
    expect(serviceBlock(production, 'site')).toContain('DISCORD_CLIENT_SECRET: ${DISCORD_CLIENT_SECRET:-}');
    expect(serviceBlock(production, 'bot')).not.toContain('DISCORD_CLIENT_SECRET');
    expect(serviceBlock(production, 'site')).not.toContain('DISCORD_BOT_TOKEN_PRODUCTION');
  });

  it('entrega GITHUB_WORKFLOW_TOKEN só ao bot de development', () => {
    const production = readFileSync(new URL('../compose.yaml', import.meta.url), 'utf8');
    const development = readFileSync(new URL('../compose.dev.yaml', import.meta.url), 'utf8');
    expect(serviceBlock(development, 'bot')).toContain('GITHUB_WORKFLOW_TOKEN: ${GITHUB_WORKFLOW_TOKEN:-}');
    expect(serviceBlock(development, 'site')).not.toContain('GITHUB_WORKFLOW_TOKEN');
    expect(production).not.toContain('GITHUB_WORKFLOW_TOKEN');
  });
});

describe('consulta de segredo ausente', () => {
  it('publish-commands não usa doppler secrets get', () => {
    const source = readFileSync(new URL('../.github/workflows/publish-commands.yml', import.meta.url), 'utf8');
    expect(source).not.toContain('doppler secrets get');
  });
});
