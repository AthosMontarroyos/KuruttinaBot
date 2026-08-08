import path from 'path';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { loggerColors } from '@kuruttina/shared';
import { getFilesRecursively } from './utils/recursive-loader';
import { CommandModule } from './types/command-interface';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DEV_GUILD_ID;

if (!token || !clientId) {
  console.error(
    loggerColors.error('❌ [Deploy] DISCORD_TOKEN e CLIENT_ID são obrigatórios no arquivo .env da raiz!')
  );
  process.exit(1);
}

// 1. Discover all commands
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = getFilesRecursively(commandsDir);

const devCommands: any[] = [];
const publicCommands: any[] = [];

console.log(loggerColors.info(`🔍 [Deploy] Varrendo ${commandFiles.length} arquivo(s) de comandos...`));

for (const filePath of commandFiles) {
  try {
    const fileModule = require(filePath);
    const commandModule: CommandModule = fileModule.command || fileModule.default;

    if (commandModule && commandModule.data) {
      const commandData = commandModule.data.toJSON();
      if (commandModule.category === 'developer') {
        devCommands.push(commandData);
        console.log(loggerColors.highlight(`  ⚙️ [Dev Command]: /${commandModule.data.name}`));
      } else {
        publicCommands.push(commandData);
        console.log(loggerColors.success(`  🌐 [Public Command]: /${commandModule.data.name}`));
      }
    }
  } catch (err) {
    console.error(loggerColors.error(`  ❌ Erro ao carregar comando ${filePath}:`), err);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

// 2. Parse CLI Scope Flag (--scope=dev | --scope=public | --scope=affiliate | --scope=all)
function getScopeFromArgs(): 'dev' | 'public' | 'affiliate' | 'all' {
  const scopeArg = process.argv.find((arg) => arg.startsWith('--scope='));
  if (scopeArg) {
    const value = scopeArg.split('=')[1]?.toLowerCase();
    if (value === 'dev' || value === 'public' || value === 'commands' || value === 'affiliate' || value === 'all') {
      return value === 'commands' ? 'public' : (value as any);
    }
  }
  if (process.argv.includes('--dev')) return 'dev';
  if (process.argv.includes('--public') || process.argv.includes('--commands')) return 'public';
  if (process.argv.includes('--affiliate')) return 'affiliate';
  return 'all';
}

(async () => {
  try {
    const isClear = process.argv.includes('--clear');
    const scope = getScopeFromArgs();

    if (isClear) {
      console.log(loggerColors.warn(`🧹 [Deploy] Limpando comandos Slash (Escopo: ${scope.toUpperCase()})...`));

      if ((scope === 'dev' || scope === 'all') && guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log(loggerColors.success('✅ [Deploy] Cache de comandos do servidor DEV zerado!'));
      }

      if (scope === 'public' || scope === 'all') {
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log(loggerColors.success('✅ [Deploy] Cache de comandos GLOBAIS zerado!'));
      }
      return;
    }

    console.log(loggerColors.highlight(`🚀 [Deploy] Iniciando sincronização no escopo: [${scope.toUpperCase()}]`));

    // SCOPE 1: DEV COMMANDS DEPLOY
    if (scope === 'dev') {
      if (!guildId) {
        console.error(loggerColors.error('❌ [Deploy Dev] DEV_GUILD_ID não configurado no .env!'));
        process.exit(1);
      }
      console.log(loggerColors.info(`📌 [Deploy Dev] Sincronizando ${devCommands.length} comando(s) /developer na Dev Guild (${guildId})...`));
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: devCommands });
      console.log(loggerColors.success('✅ [Deploy Dev] Comandos /developer registrados na Dev Guild!'));
      return;
    }

    // SCOPE 2: PUBLIC / COMMANDS DEPLOY
    if (scope === 'public') {
      console.log(loggerColors.info(`🌐 [Deploy Public] Sincronizando ${publicCommands.length} comando(s) públicos...`));
      if (guildId) {
        // Fast deployment in Dev Guild for testing public commands
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: publicCommands });
        console.log(loggerColors.success(`✅ [Deploy Public] ${publicCommands.length} comando(s) públicos registrados na Dev Guild!`));
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body: publicCommands });
        console.log(loggerColors.success(`✅ [Deploy Public] ${publicCommands.length} comando(s) públicos registrados GLOBALMENTE!`));
      }
      return;
    }

    // SCOPE 3: AFFILIATE GUILDS DEPLOY
    if (scope === 'affiliate') {
      console.log(loggerColors.warn('📌 [Deploy Affiliate] Módulo de afiliados detectado. (Aguardando integração da tabela Supabase affiliate_guilds).'));
      console.log(loggerColors.info('ℹ️ [Deploy Affiliate] Comandos afiliados são registrados de forma otimizada On-Demand (sem inflar custos AWS).'));
      return;
    }

    // SCOPE 4: ALL (Dev Commands in Dev Guild + Public Commands in Dev Guild / Global)
    if (scope === 'all') {
      if (guildId) {
        const allDevGuildCommands = [...devCommands, ...publicCommands];
        console.log(
          loggerColors.info(
            `📌 [Deploy All] Sincronizando ${allDevGuildCommands.length} comando(s) (${devCommands.length} dev + ${publicCommands.length} públicos) na Dev Guild (${guildId})...`
          )
        );
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: allDevGuildCommands });
        console.log(loggerColors.success('✅ [Deploy All] Todos os comandos registrados na Dev Guild!'));

        // Clear global stale commands to avoid duplicate entries during development
        console.log(loggerColors.info('🧹 [Deploy All] Limpando comandos globais antigos para evitar duplicação...'));
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log(loggerColors.success('✅ [Deploy All] Cache global limpo com sucesso!'));
      } else {
        console.log(loggerColors.info(`🌐 [Deploy All] Sincronizando ${publicCommands.length} comando(s) públicos GLOBALMENTE...`));
        await rest.put(Routes.applicationCommands(clientId), { body: publicCommands });
        console.log(loggerColors.success('✅ [Deploy All] Comandos públicos registrados GLOBALMENTE!'));
      }
    }
  } catch (error) {
    console.error(loggerColors.error('❌ [Deploy] Erro na sincronização de comandos Slash:'), error);
  }
})();
