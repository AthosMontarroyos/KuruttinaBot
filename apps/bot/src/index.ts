import { randomUUID } from 'node:crypto';
import { startBot } from '#bot/bootstrap.js';
import { log } from '#bot/infrastructure/logging/logger.js';

const correlationId = randomUUID();

startBot(correlationId).catch((error: unknown) => {
  log('error', 'startup_failed', {
    correlationId,
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
