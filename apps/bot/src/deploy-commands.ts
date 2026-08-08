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

const commands: any[] = [];
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = getFilesRecursively(commandsDir);

console.log(loggerColors.info(`🔍 [Deploy] Encontrados ${commandFiles.length} arquivos de comandos...`));

for (const filePath of commandFiles) {
  try {
    const fileModule = require(filePath);
    const commandModule: CommandModule = fileModule.command || fileModule.default;

    if (commandModule && commandModule.data) {
      commands.push(commandModule.data.toJSON());
      console.log(loggerColors.success(`  ✓ Registrado: /${commandModule.data.name}`));
    } else {
      console.warn(loggerColors.warn(`  ⚠️ [Aviso] Arquivo ${filePath} não exporta um 'command' válido com 'data'.`));
    }
  } catch (err) {
    console.error(loggerColors.error(`  ❌ Erro ao carregar comando ${filePath}:`), err);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    const isClear = process.argv.includes('--clear');

    if (isClear) {
      console.log(loggerColors.warn('🧹 [Deploy] Limpando todos os comandos Slash do cache do Discord...'));

      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log(loggerColors.success('✅ [Deploy] Cache de comandos do servidor DEV zerado!'));
      }

      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log(loggerColors.success('✅ [Deploy] Cache de comandos GLOBAIS zerado!'));
      return;
    }

    console.log(loggerColors.highlight(`🚀 [Deploy] Sincronizando ${commands.length} comando(s) Slash ativos...`));

    if (guildId) {
      // 1. Overwrite Guild Commands (DEV)
      console.log(loggerColors.info(`📌 [Deploy] Sincronizando comandos no servidor DEV (Guild ID: ${guildId})...`));
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(loggerColors.success('✅ [Deploy] Comandos Slash registrados no servidor DEV!'));

      // 2. Clear stale Global commands to prevent duplicate entries in dev
      console.log(loggerColors.info('🧹 [Deploy] Limpando comandos globais antigos para evitar duplicação...'));
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log(loggerColors.success('✅ [Deploy] Cache global antigo zerado com sucesso!'));
    } else {
      // Global deploy
      console.log(loggerColors.info('🌐 [Deploy] Sincronizando comandos GLOBALMENTE no Discord...'));
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log(loggerColors.success('✅ [Deploy] Comandos Slash registrados GLOBALMENTE com sucesso!'));
    }
  } catch (error) {
    console.error(loggerColors.error('❌ [Deploy] Erro ao sincronizar comandos Slash no Discord REST API:'), error);
  }
})();
