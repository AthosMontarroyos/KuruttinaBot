import type { Deployment, DeploymentContext } from '#bot/deployments/types.js';
import { log } from '#bot/infrastructure/logger.js';

export class DeploymentsHandler {
  constructor(private readonly registeredDeployments: readonly Deployment[]) {}

  async run(context: DeploymentContext): Promise<void> {
    for (const deployment of this.registeredDeployments) {
      log('info', 'deployment_started', { correlationId: context.correlationId, deployment: deployment.name });
      await deployment.run(context);
      log('info', 'deployment_completed', { correlationId: context.correlationId, deployment: deployment.name });
    }
  }
}
