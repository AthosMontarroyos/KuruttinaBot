import type { BotConfig } from '#bot/config.js';

export type DeploymentContext = Readonly<{
  config: BotConfig;
  applicationId: string;
}>;

export type Deployment = Readonly<{
  name: string;
  run: (context: DeploymentContext) => Promise<void>;
}>;
