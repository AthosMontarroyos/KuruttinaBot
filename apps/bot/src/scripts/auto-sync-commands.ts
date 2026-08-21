import { loggerColors } from '@kuruttina/shared';
import { syncSlashCommands } from '../deploy-commands';

function isAutoSyncEnabled(): boolean {
  return process.env.AUTO_SYNC_COMMANDS?.trim().toLowerCase() === 'true';
}

/**
 * Runs the complete command synchronization only when explicitly enabled in
 * the root environment. Keeping this in a dedicated script makes startup
 * behavior visible and preserves deploy-commands.ts as the sole deploy path.
 */
export async function syncCommandsOnStartup(): Promise<void> {
  if (!isAutoSyncEnabled()) {
    console.log(loggerColors.muted('⏭️ [Startup Sync] Desativado (AUTO_SYNC_COMMANDS não é true).'));
    return;
  }

  console.log(loggerColors.info('🔄 [Startup Sync] Sincronizando todos os comandos configurados...'));
  await syncSlashCommands('all');
}

if (require.main === module) {
  syncCommandsOnStartup().catch((error: unknown) => {
    console.error(loggerColors.error('❌ [Startup Sync] Falha ao sincronizar comandos:'), error);
    process.exitCode = 1;
  });
}
