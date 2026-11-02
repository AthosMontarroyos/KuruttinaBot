// @ts-nocheck
// Regenera packages/command-catalog/catalog.js a partir dos módulos de commands.
// Roda sozinho no build do site e no typecheck; executa o código-fonte do bot com tsx
// (`node --import tsx scripts/commands-catalog.mjs`), sem depender do build do bot.

import { writeFile } from 'node:fs/promises';

const { loadCommands } = await import('../apps/bot/src/command-system/loadCommands.ts');
const { buildCatalog, renderCatalogModule } = await import('../apps/bot/src/command-system/commandCatalog.ts');

const catalog = buildCatalog(await loadCommands());
await writeFile(new URL('../packages/command-catalog/catalog.js', import.meta.url), renderCatalogModule(catalog), 'utf8');
console.log(`Catálogo de comandos atualizado: ${catalog.length} comando(s).`);
