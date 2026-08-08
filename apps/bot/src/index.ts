import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { getFilesRecursively } from './utils/recursive-loader';
import { CommandModule } from './types/command-interface';

// 1. Load root .env file strictly from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ [Kuruttina Bot] DISCORD_TOKEN não encontrado no arquivo .env da raiz!');
  process.exit(1);
}

// 2. Initialize Discord Client with GatewayIntents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Initialize collection for commands
client.commands = new Collection<string, CommandModule>();

// 3. Load Commands Recursively
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = getFilesRecursively(commandsDir);

console.log(`📦 [Kuruttina Loader] Carregando ${commandFiles.length} comando(s)...`);

for (const filePath of commandFiles) {
  try {
    const fileModule = require(filePath);
    const commandModule: CommandModule = fileModule.command || fileModule.default;

    if (commandModule && commandModule.data) {
      client.commands.set(commandModule.data.name, commandModule);
      console.log(`  ✓ Comando registrado: /${commandModule.data.name} (Prefixo: ${commandModule.prefixAliases?.join(', ') || 'nenhum'})`);
    }
  } catch (err) {
    console.error(`  ❌ Falha ao carregar arquivo de comando ${filePath}:`, err);
  }
}

// 4. Load Events Recursively
const eventsDir = path.join(__dirname, 'events');
const eventFiles = getFilesRecursively(eventsDir);

console.log(`📡 [Kuruttina Loader] Carregando ${eventFiles.length} evento(s)...`);

for (const filePath of eventFiles) {
  try {
    const fileModule = require(filePath);
    const eventModule = fileModule.event || fileModule.default;

    if (eventModule && eventModule.name) {
      if (eventModule.once) {
        client.once(eventModule.name, (...args) => eventModule.execute(...args));
      } else {
        client.on(eventModule.name, (...args) => eventModule.execute(...args));
      }
      console.log(`  ✓ Evento registrado: ${eventModule.name}`);
    }
  } catch (err) {
    console.error(`  ❌ Falha ao carregar arquivo de evento ${filePath}:`, err);
  }
}

// 5. Connect Kuruttina to Discord Gateway
client.login(token).catch((err) => {
  console.error('❌ [Kuruttina Bot] Falha ao efetuar login no Discord:', err);
  process.exit(1);
});
