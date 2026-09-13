import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const botSource = fileURLToPath(new URL('./apps/bot/src/', import.meta.url)).replaceAll('\\', '/');

export default defineConfig({
  resolve: {
    alias: [{ find: /^#bot\/(.*)$/u, replacement: `${botSource}$1` }],
  },
});
