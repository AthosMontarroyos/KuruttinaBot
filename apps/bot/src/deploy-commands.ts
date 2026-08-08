import path from 'path';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { getFilesRecursively } from './utils/recursive-loader';
import { CommandModule } from './types/command-interface';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DEV_GUILD_ID;

if (!token || !clientId) {
  console.error('❌ [Deploy] DISCORD_TOKEN e CLIENT_ID são obrigatórios no arquivo .env da raiz!');
  process.exit(1);
}

const commands: any[] = [];
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = getFilesRecursively(commandsDir);

console.log(`🔍 [Deploy] Encontrados ${commandFiles.length} arquivos de comandos...`);

for (const filePath of commandFiles) {
  try {
    const fileModule = require(filePath);
    const commandModule: CommandModule = fileModule.command || fileModule.default;

    if (commandModule && commandModule.data) {
      commands.push(commandModule.data.toJSON());
      console.log(`  ✓ Registrado: /${commandModule.data.name}`);
    } else {
      console.warn(`  ⚠️ [Aviso] Arquivo ${filePath} não exporta um 'command' válido com 'data'.`);
    }
  } catch (err) {
    console.error(`  ❌ Erro ao carregar comando ${filePath}:`, err);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`🚀 [Deploy] Iniciando registro de ${commands.length} comandos Slash...`);

    if (guildId) {
      // Fast guild deploy for development
      console.log(`📌 [Deploy] Efetuando deploy no servidor de desenvolvimento (Guild ID: ${guildId})...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log('✅ [Deploy] Comandos Slash registrados no servidor DEV com sucesso!');
    } else {
      // Global deploy
      console.log('🌐 [Deploy] Efetuando deploy GLOBAL de comandos Slash...');
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log('✅ [Deploy] Comandos Slash registrados GLOBALMENTE com sucesso!');
    }
  } catch (error) {
    console.error('❌ [Deploy] Erro ao registrar comandos Slash no Discord REST API:', error);
  }
})();
