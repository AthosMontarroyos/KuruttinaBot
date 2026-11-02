import type { BotConfig } from '#bot/config.js';

export type DeploymentContext = Readonly<{
  config: BotConfig;
  applicationId: string;
  correlationId: string;
  /** Publish even without differences; set by the manual `deploy:commands` run. */
  force?: boolean;
}>;

export type Deployment = Readonly<{
  name: string;
  run: (context: DeploymentContext) => Promise<void>;
}>;
