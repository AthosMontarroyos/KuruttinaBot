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
${migrationFunction()}
status=0
migration_configured || status=$?
printf 'STATUS=%s\\n' "\${status}"
`,
  );
  chmodSync(script, 0o755);
  return execFileSync(script, {
    encoding: 'utf8',
    env: {
      PATH: `${root}:/usr/bin:/bin`,
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

describe('consulta de segredo ausente', () => {
  it('publish-commands não usa doppler secrets get', () => {
    const source = readFileSync(new URL('../.github/workflows/publish-commands.yml', import.meta.url), 'utf8');
    expect(source).not.toContain('doppler secrets get');
  });
});
