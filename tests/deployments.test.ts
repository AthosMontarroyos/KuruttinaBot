import { describe, expect, it, vi } from 'vitest';
import { DeploymentsHandler } from '../apps/bot/src/handlers/DeploymentsHandler.js';
import type { Deployment, DeploymentContext } from '../apps/bot/src/deployments/types.js';

const context: DeploymentContext = {
  applicationId: '123456789012345678',
  config: {
    target: 'development',
    credentials: { development: { token: 'fake-token', expectedBotId: '123456789012345678' }, production: { token: 'fake-prod-token', expectedBotId: '987654321098765432' } },
    activeCredential: { token: 'fake-token', expectedBotId: '123456789012345678' },
    autoSyncCommands: true,
    assetsBaseUrl: 'https://assets.example.com',
  },
};

describe('deployments', () => {
  it('runs every registered deployment sequentially', async () => {
    const order: string[] = [];
    const registered: Deployment[] = [
      { name: 'central', run: vi.fn(async () => void order.push('central')) },
      { name: 'guild', run: vi.fn(async () => void order.push('guild')) },
    ];

    await new DeploymentsHandler(registered).run(context);

    expect(order).toEqual(['central', 'guild']);
  });

  it('stops when a deployment fails', async () => {
    const next = vi.fn(async () => undefined);
    const registered: Deployment[] = [
      { name: 'broken', run: async () => Promise.reject(new Error('deploy failed')) },
      { name: 'next', run: next },
    ];

    await expect(new DeploymentsHandler(registered).run(context)).rejects.toThrow('deploy failed');
    expect(next).not.toHaveBeenCalled();
  });
});
