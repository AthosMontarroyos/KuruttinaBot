import { startBot } from '#bot/bootstrap.js';
import { log } from '#bot/infrastructure/logger.js';

startBot().catch((error: unknown) => {
  log('error', 'startup_failed', { message: error instanceof Error ? error.message : 'unknown error' });
  process.exitCode = 1;
});
