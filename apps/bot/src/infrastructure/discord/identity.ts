const identityEndpoint = 'https://discord.com/api/v10/users/@me';

export async function verifyBotIdentity(token: string, expectedBotId: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(identityEndpoint, {
      headers: { Authorization: `Bot ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw Object.assign(new Error(`Discord token validation failed (${response.status})`), { name: 'BotIdentityError' });
    }

    const body: unknown = await response.json();
    if (
      !body ||
      typeof body !== 'object' ||
      !('id' in body) ||
      typeof body.id !== 'string' ||
      !('bot' in body) ||
      body.bot !== true ||
      body.id !== expectedBotId
    ) {
      throw Object.assign(new Error('Discord bot identity mismatch'), { name: 'BotIdentityError' });
    }

    return body.id;
  } finally {
    clearTimeout(timer);
  }
}
