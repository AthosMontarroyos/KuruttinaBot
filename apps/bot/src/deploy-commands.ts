import path from 'path';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { loggerColors } from '@kuruttina/shared';
import { getFilesRecursively } from './utils/recursive-loader';
import { CommandModule } from './types/command-interface';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export async function syncSlashCommands(
  targetScope: 'dev' | 'public' | 'affiliate' | 'all' = 'all',
  isClear = false
): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DEV_GUILD_ID;

  if (!token || !clientId) {
    console.error(
      loggerColors.error('❌ [Deploy] DISCORD_TOKEN e CLIENT_ID são obrigatórios no arquivo .env da raiz!')
    );
    return;
  }

  const commandsDir = path.join(__dirname, 'commands');
  const commandFiles = getFilesRecursively(commandsDir);

  const devCommands: any[] = [];
  const publicCommands: any[] = [];

  for (const filePath of commandFiles) {
    try {
      const fileModule = require(filePath);
      const commandModule: CommandModule = fileModule.command || fileModule.default;

      if (commandModule && commandModule.data) {
        const commandData = commandModule.data.toJSON();
        if (commandModule.category === 'developer') {
          devCommands.push(commandData);
        } else {
          publicCommands.push(commandData);
        }
      }
    } catch (err) {
      console.error(loggerColors.error(`  ❌ Erro ao carregar comando ${filePath}:`), err);
    }
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (isClear) {
      console.log(loggerColors.warn(`🧹 [Deploy] Limpando comandos Slash (Escopo: ${targetScope.toUpperCase()})...`));

      if ((targetScope === 'dev' || targetScope === 'all') && guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log(loggerColors.success('✅ [Deploy] Cache do servidor DEV zerado!'));
      }

      if (targetScope === 'public' || targetScope === 'all') {
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log(loggerColors.success('✅ [Deploy] Cache GLOBAL zerado!'));
      }
      return;
    }

    console.log(loggerColors.highlight(`🚀 [Deploy] Sincronizando comandos Slash...`));

    // 1. Register Public Commands GLOBALLY (Available in ALL servers where Kuruttina is invited)
    if (targetScope === 'public' || targetScope === 'all') {
      console.log(
        loggerColors.info(`🌐 [Deploy Public] Sincronizando ${publicCommands.length} comando(s) públicos GLOBALMENTE...`)
      );
      await rest.put(Routes.applicationCommands(clientId), { body: publicCommands });
      console.log(
        loggerColors.success(`✅ [Deploy Public] ${publicCommands.length} comando(s) públicos registrados GLOBALMENTE!`)
      );
    }

    // 2. Register Developer Commands ONLY in DEV_GUILD_ID
    if ((targetScope === 'dev' || targetScope === 'all') && guildId) {
      console.log(
        loggerColors.info(
          `📌 [Deploy Dev] Sincronizando ${devCommands.length} comando(s) /developer na Dev Guild (${guildId})...`
        )
      );
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: devCommands });
      console.log(
        loggerColors.success(`✅ [Deploy Dev] ${devCommands.length} comando(s) /developer registrados na Dev Guild!`)
      );
    }
  } catch (error) {
    console.error(loggerColors.error('❌ [Deploy] Erro na sincronização de comandos Slash:'), error);
  }
}

// Support direct CLI execution: ts-node src/deploy-commands.ts
if (require.main === module) {
  function getScopeFromArgs(): 'dev' | 'public' | 'affiliate' | 'all' {
    const scopeArg = process.argv.find((arg) => arg.startsWith('--scope='));
    if (scopeArg) {
      const value = scopeArg.split('=')[1]?.toLowerCase();
      if (
        value === 'dev' ||
        value === 'public' ||
        value === 'commands' ||
        value === 'affiliate' ||
        value === 'all'
      ) {
        return value === 'commands' ? 'public' : (value as any);
      }
    }
    if (process.argv.includes('--dev')) return 'dev';
    if (process.argv.includes('--public') || process.argv.includes('--commands')) return 'public';
    if (process.argv.includes('--affiliate')) return 'affiliate';
    return 'all';
  }

  const isClear = process.argv.includes('--clear');
  const scope = getScopeFromArgs();
  syncSlashCommands(scope, isClear);
}
