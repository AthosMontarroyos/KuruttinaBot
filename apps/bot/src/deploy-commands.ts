import path from 'path';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { loggerColors } from '@kuruttina/shared';
import { getFilesRecursively } from './utils/recursive-loader';
import { CommandModule } from './types/command-interface';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Smart Sync Diff Engine: Compares remote Discord API commands with local active commands.
 */
async function syncCommandGroup(
  rest: REST,
  route: string,
  localCommands: any[],
  scopeLabel: string,
  forceFresh = false
): Promise<void> {
  if (forceFresh) {
    console.log(
      loggerColors.warn(`🧹 [Opção 1: Fresh-Deploy ${scopeLabel}] Limpando cache e realizando deploy do zero...`)
    );
    await rest.put(route as any, { body: [] });
    await rest.put(route as any, { body: localCommands });
    console.log(
      loggerColors.success(`✅ [Fresh-Deploy ${scopeLabel}] ${localCommands.length} comando(s) implantados do zero!`)
    );
    return;
  }

  try {
    // 1. Fetch currently registered commands on Discord API (Opção 2: Smart-Sync Diff)
    const remoteCommands = (await rest.get(route as any)) as any[];

    // 2. Compare Remote vs Local
    let needsSync = remoteCommands.length !== localCommands.length;

    if (!needsSync) {
      const remoteMap = new Map(remoteCommands.map((c) => [c.name, c]));
      for (const localCmd of localCommands) {
        const remoteCmd = remoteMap.get(localCmd.name);
        if (!remoteCmd || remoteCmd.description !== localCmd.description) {
          needsSync = true;
          break;
        }
      }
    }

    if (needsSync) {
      console.log(
        loggerColors.highlight(
          `🔄 [Opção 2: Smart-Sync ${scopeLabel}] Alterações/diferenças detectadas. Sincronizando com Discord REST API...`
        )
      );
      await rest.put(route as any, { body: localCommands });
      console.log(
        loggerColors.success(`✅ [Smart-Sync ${scopeLabel}] ${localCommands.length} comando(s) sincronizado(s)!`)
      );
    } else {
      console.log(
        loggerColors.muted(
          `✨ [Opção 2: Smart-Sync ${scopeLabel}] Comandos já estão 100% em sintonia com a API do Discord (${localCommands.length} ativo(s)). Nenhuma requisição desnecessária efetuada.`
        )
      );
    }
  } catch {
    // Fallback: If GET fails, perform direct sync
    console.log(loggerColors.info(`📌 [Smart-Sync ${scopeLabel}] Sincronizando ${localCommands.length} comando(s)...`));
    await rest.put(route as any, { body: localCommands });
    console.log(loggerColors.success(`✅ [Smart-Sync ${scopeLabel}] ${localCommands.length} comando(s) sincronizado(s)!`));
  }
}

export async function syncSlashCommands(
  targetScope: 'dev' | 'public' | 'affiliate' | 'all' = 'all',
  isClear = false,
  forceFresh = false
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

  // 1. Sync Public Commands GLOBALLY (Smart-Sync Diff Engine)
  if (targetScope === 'public' || targetScope === 'all') {
    await syncCommandGroup(
      rest,
      Routes.applicationCommands(clientId),
      publicCommands,
      'GLOBAL',
      forceFresh
    );
  }

  // 2. Sync Developer Commands strictly in DEV_GUILD_ID
  if ((targetScope === 'dev' || targetScope === 'all') && guildId) {
    await syncCommandGroup(
      rest,
      Routes.applicationGuildCommands(clientId, guildId),
      devCommands,
      'DEV GUILD',
      forceFresh
    );
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
  const forceFresh = process.argv.includes('--fresh') || process.argv.includes('--clean-deploy');
  const scope = getScopeFromArgs();
  syncSlashCommands(scope, isClear, forceFresh);
}
