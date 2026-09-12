import { centralDeployment } from '#bot/deployments/central.js';
import type { Deployment, DeploymentContext } from '#bot/deployments/types.js';
import { log } from '#bot/infrastructure/logger.js';

export const deployments: readonly Deployment[] = [centralDeployment];

export class DeploymentsHandler {
  constructor(private readonly registeredDeployments: readonly Deployment[] = deployments) {}

  async run(context: DeploymentContext): Promise<void> {
    for (const deployment of this.registeredDeployments) {
      log('info', 'deployment_started', { deployment: deployment.name });
      await deployment.run(context);
      log('info', 'deployment_completed', { deployment: deployment.name });
    }
  }
}
