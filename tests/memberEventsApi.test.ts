import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { readSiteConfig } from '../apps/site/server/config.js';
import { createMemberEventsApi } from '../apps/site/server/member-events.js';

const environment = {
  SESSION_FILE: '',
  APP_ENV: 'production',
  SITE_URL: 'https://kuruttina.athosmontarroyos.com',
  ASSETS_BASE_URL: 'https://assets.example.com/',
  DATABASE_URL: 'postgres://kuruttina_site:test-pw@db.internal:5432/kuruttina',
  DISCORD_BOT_TOKEN: 'secret-bot-token',
};
const siteUrl = environment.SITE_URL;
const guildId = '123456789012345678';
const channelId = '200000000000000002';
const actorId = '111111111111111111';

describe('member events API', () => {
  let server: Server;
  let origin = '';
  let authorization: { status: 'unauthenticated' } | { status: 'forbidden' } | { status: 'ok'; discordId: string } = { status: 'ok', discordId: actorId };
  const authorizedGuilds: string[] = [];
  const database = { memberEvents: { list: vi.fn(), get: vi.fn(), save: vi.fn() }, deliveries: { create: vi.fn() } };
  const discord = { listChannels: vi.fn() };

  const welcome = { content: 'Bem-vindo, {user.mention}!', embeds: [], components: [] };

  function put(path: string, body: unknown) {
    return fetch(`${origin}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Origin: siteUrl },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  function post(path: string, body: unknown, headers: Record<string, string> = { Origin: siteUrl }) {
    return fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  function validBody(overrides: Record<string, unknown> = {}) {
    return { expectedVersion: null, enabled: true, channelId, ignoreBots: true, contentJson: JSON.stringify(welcome), ...overrides };
  }

  function testBody(overrides: Record<string, unknown> = {}) {
    return { channelId, contentJson: JSON.stringify(welcome), ...overrides };
  }

  beforeEach(async () => {
    authorization = { status: 'ok', discordId: actorId };
    authorizedGuilds.length = 0;
    database.memberEvents.list.mockReset();
    database.memberEvents.get.mockReset();
    database.memberEvents.save.mockReset();
    database.deliveries.create.mockReset();
    discord.listChannels.mockReset();
    discord.listChannels.mockResolvedValue({
      ok: true,
      items: [{ id: channelId, name: 'geral', type: 'text', category: null }],
    });
    const api = createMemberEventsApi(
      readSiteConfig(environment),
      {
        getAuthorizedGuild: (_req: IncomingMessage, id: string) => { authorizedGuilds.push(id); return authorization; },
      } as never,
      database as never,
      discord as never,
    );
    server = createServer((req, res) => {
      if (!api.handle(req, res, (req.url ?? '').split('?')[0] ?? '')) res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('answers 401 without a session, for the list and for the update, without touching the database', async () => {
    authorization = { status: 'unauthenticated' };
    const list = await fetch(`${origin}/api/guilds/${guildId}/member-events`);
    expect(list.status).toBe(401);
    expect(await list.json()).toEqual({ error: 'unauthenticated' });
    const update = await put(`/api/guilds/${guildId}/member-events/join`, validBody());
    expect(update.status).toBe(401);
    expect(database.memberEvents.list).not.toHaveBeenCalled();
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });

  it('lists only the events already saved, with the content as JSON text and the ISO date', async () => {
    database.memberEvents.list.mockResolvedValueOnce([
      {
        event: 'join',
        enabled: true,
        channelId,
        ignoreBots: true,
        content: { content: 'oi' },
        version: 2,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const response = await fetch(`${origin}/api/guilds/${guildId}/member-events`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{
        event: 'join',
        enabled: true,
        channelId,
        ignoreBots: true,
        contentJson: '{"content":"oi"}',
        version: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    });
    expect(database.memberEvents.list).toHaveBeenCalledWith(guildId);
    expect(authorizedGuilds).toEqual([guildId]);
  });

  it('creates the message of an event with expectedVersion null and answers version 1', async () => {
    database.memberEvents.save.mockResolvedValueOnce({ ok: true, version: 1 });
    const response = await put(`/api/guilds/${guildId}/member-events/join`, validBody());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ event: 'join', version: 1 });
    expect(database.memberEvents.save).toHaveBeenCalledWith({
      guildId,
      event: 'join',
      expectedVersion: null,
      enabled: true,
      channelId,
      ignoreBots: true,
      content: welcome,
      actorId,
    });
  });

  it('updates the message of an event with the expected version', async () => {
    database.memberEvents.save.mockResolvedValueOnce({ ok: true, version: 4 });
    const response = await put(`/api/guilds/${guildId}/member-events/leave`, validBody({ expectedVersion: 3, enabled: false, channelId: null }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ event: 'leave', version: 4 });
    expect(database.memberEvents.save).toHaveBeenCalledWith(expect.objectContaining({ event: 'leave', expectedVersion: 3, enabled: false, channelId: null }));
    expect(discord.listChannels).not.toHaveBeenCalled();
  });

  it('answers 409 conflict when the saved version is not the expected one', async () => {
    database.memberEvents.save.mockResolvedValueOnce({ ok: false, code: 'conflict' });
    const response = await put(`/api/guilds/${guildId}/member-events/join`, validBody({ expectedVersion: 1 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'conflict' });
  });

  it('answers 422 validation with the details of the template engine, and invalid_json for a broken content', async () => {
    const unknownVariable = await put(`/api/guilds/${guildId}/member-events/join`, validBody({
      contentJson: JSON.stringify({ content: 'Oi {nope}', embeds: [], components: [] }),
    }));
    expect(unknownVariable.status).toBe(422);
    const body = await unknownVariable.json() as { error: string; details: Array<{ code: string; path: string; message: string }> };
    expect(body.error).toBe('validation');
    expect(body.details[0]).toEqual(expect.objectContaining({ code: 'unknown_variable', path: 'content' }));
    expect(typeof body.details[0]?.message).toBe('string');

    const broken = await put(`/api/guilds/${guildId}/member-events/join`, validBody({ contentJson: '{' }));
    expect(broken.status).toBe(422);
    expect(await broken.json()).toEqual({
      error: 'validation',
      details: [{ code: 'invalid_json', path: '', message: 'O JSON da mensagem é inválido.' }],
    });
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });

  it('answers 422 components_not_allowed when the message has buttons or menus', async () => {
    const withButton = { content: 'Oi', embeds: [], components: [{ kind: 'buttons', buttons: [{ style: 'link', label: 'Abrir', url: 'https://exemplo.com' }] }] };
    const response = await put(`/api/guilds/${guildId}/member-events/join`, validBody({ contentJson: JSON.stringify(withButton) }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: 'validation',
      details: [{ code: 'components_not_allowed', path: 'components', message: 'Botões e menus não estão disponíveis nesta mensagem.' }],
    });
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });

  it('answers 422 invalid_channel when the channel does not exist in the guild', async () => {
    discord.listChannels.mockResolvedValueOnce({ ok: true, items: [{ id: '200000000000000009', name: 'outro', type: 'text', category: null }] });
    const response = await put(`/api/guilds/${guildId}/member-events/join`, validBody());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'invalid_channel' });
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });

  it('answers 422 channel_required when the event is enabled without a channel, without asking Discord', async () => {
    const response = await put(`/api/guilds/${guildId}/member-events/join`, validBody({ channelId: null }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'channel_required' });
    expect(discord.listChannels).not.toHaveBeenCalled();
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });

  it('answers 404 not_found for an event other than join or leave, before authorizing', async () => {
    const response = await put(`/api/guilds/${guildId}/member-events/boost`, validBody());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
    const list = await fetch(`${origin}/api/guilds/${guildId}/member-events/boost`);
    expect(list.status).toBe(404);
    expect(authorizedGuilds).toEqual([]);
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });

  it('sends the test of the draft to the channel with the parsed content and the actor as requester, without saving, answering 202', async () => {
    database.deliveries.create.mockResolvedValueOnce({ ok: true });
    const response = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    expect(database.deliveries.create).toHaveBeenCalledWith({ guildId, channelId, content: welcome, requestedBy: actorId });
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });

  it('tests the draft of the leave event even when it is disabled and without a saved channel', async () => {
    database.deliveries.create.mockResolvedValueOnce({ ok: true });
    const response = await post(`/api/guilds/${guildId}/member-events/leave/test`, testBody());
    expect(response.status).toBe(202);
    expect(database.deliveries.create).toHaveBeenCalledWith(expect.objectContaining({ guildId, channelId, requestedBy: actorId }));
    expect(database.memberEvents.list).not.toHaveBeenCalled();
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });

  it('answers 403 for the test without the Origin of the site, before authorizing', async () => {
    const withoutOrigin = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody(), {});
    expect(withoutOrigin.status).toBe(403);
    expect(await withoutOrigin.json()).toEqual({ error: 'forbidden' });
    const otherOrigin = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody(), { Origin: 'https://exemplo.com' });
    expect(otherOrigin.status).toBe(403);
    expect(authorizedGuilds).toEqual([]);
    expect(database.deliveries.create).not.toHaveBeenCalled();
  });

  it('answers 422 validation for a test with broken JSON or an unknown variable, without sending', async () => {
    const broken = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody({ contentJson: '{' }));
    expect(broken.status).toBe(422);
    expect(await broken.json()).toEqual({
      error: 'validation',
      details: [{ code: 'invalid_json', path: '', message: 'O JSON da mensagem é inválido.' }],
    });
    const unknownVariable = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody({
      contentJson: JSON.stringify({ content: 'Oi {nope}', embeds: [], components: [] }),
    }));
    expect(unknownVariable.status).toBe(422);
    const body = await unknownVariable.json() as { error: string; details: Array<{ code: string; path: string }> };
    expect(body.error).toBe('validation');
    expect(body.details[0]).toEqual(expect.objectContaining({ code: 'unknown_variable', path: 'content' }));
    expect(database.deliveries.create).not.toHaveBeenCalled();
  });

  it('answers 422 components_not_allowed for a test with buttons or menus', async () => {
    const withButton = { content: 'Oi', embeds: [], components: [{ kind: 'buttons', buttons: [{ style: 'link', label: 'Abrir', url: 'https://exemplo.com' }] }] };
    const response = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody({ contentJson: JSON.stringify(withButton) }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: 'validation',
      details: [{ code: 'components_not_allowed', path: 'components', message: 'Botões e menus não estão disponíveis nesta mensagem.' }],
    });
    expect(database.deliveries.create).not.toHaveBeenCalled();
  });

  it('answers 422 invalid_channel for a test to a channel that is not a snowflake or not in the guild', async () => {
    const notSnowflake = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody({ channelId: 'geral' }));
    expect(notSnowflake.status).toBe(422);
    expect(await notSnowflake.json()).toEqual({ error: 'invalid_channel' });
    expect(discord.listChannels).not.toHaveBeenCalled();

    discord.listChannels.mockResolvedValueOnce({ ok: true, items: [{ id: '200000000000000009', name: 'outro', type: 'text', category: null }] });
    const missing = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody());
    expect(missing.status).toBe(422);
    expect(await missing.json()).toEqual({ error: 'invalid_channel' });
    expect(database.deliveries.create).not.toHaveBeenCalled();
  });

  it('answers 409 quota when the delivery is refused', async () => {
    database.deliveries.create.mockResolvedValueOnce({ ok: false, code: 'quota' });
    const response = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'quota' });
  });

  it('answers 401 or 404 for the test without authorization, without touching the channels or the delivery', async () => {
    authorization = { status: 'unauthenticated' };
    const unauthenticated = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody());
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({ error: 'unauthenticated' });

    authorization = { status: 'forbidden' };
    const forbidden = await post(`/api/guilds/${guildId}/member-events/join/test`, testBody());
    expect(forbidden.status).toBe(404);
    expect(await forbidden.json()).toEqual({ error: 'not_found' });

    expect(discord.listChannels).not.toHaveBeenCalled();
    expect(database.deliveries.create).not.toHaveBeenCalled();
  });

  it('answers 405 with Allow POST for other methods on the test, and 404 for an event other than join or leave', async () => {
    const get = await fetch(`${origin}/api/guilds/${guildId}/member-events/join/test`);
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    const put405 = await put(`/api/guilds/${guildId}/member-events/join/test`, testBody());
    expect(put405.status).toBe(405);
    expect(put405.headers.get('allow')).toBe('POST');
    const boost = await post(`/api/guilds/${guildId}/member-events/boost/test`, testBody());
    expect(boost.status).toBe(404);
    expect(authorizedGuilds).toEqual([]);
    expect(database.deliveries.create).not.toHaveBeenCalled();
  });

  it('keeps the update on PUT only, answering 405 with Allow PUT to other methods on the event', async () => {
    const response = await post(`/api/guilds/${guildId}/member-events/join`, validBody());
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('PUT');
    expect(database.deliveries.create).not.toHaveBeenCalled();
    expect(database.memberEvents.save).not.toHaveBeenCalled();
  });
});
