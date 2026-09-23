import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const botSource = fileURLToPath(new URL('./apps/bot/src/', import.meta.url)).replaceAll('\\', '/');

export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'R2/**', 'infra/n8n/**'] },
  resolve: {
    alias: [{ find: /^#bot\/(.*)$/u, replacement: `${botSource}$1` }],
  },
});
