import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { diffCommands, syncCommands, type CommandRegistry } from '../apps/bot/src/infrastructure/discord/commands/syncCommands.js';

const ban = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Bane um usuário do servidor')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((option) => option.setName('membro').setDescription('Usuário').setRequired(true))
  .addStringOption((option) => option.setName('motivo').setDescription('Motivo').setRequired(false));
const ping = new SlashCommandBuilder().setName('ping').setDescription('Mostra a latencia');

/** What Discord returns for a registered command: the same fields plus server-side defaults. */
function registered(command: { toJSON(): object }, id: string): Record<string, unknown> {
  const json = JSON.parse(JSON.stringify(command.toJSON())) as Record<string, unknown>;
  const options = (json.options as Record<string, unknown>[] | undefined)?.map((option) => ({
    ...option,
    name_localizations: null,
    description_localizations: null,
    ...(option.required === false ? { required: undefined } : {}),
  }));
  return {
    ...json,
    ...(options ? { options } : {}),
    id,
    application_id: '1',
    version: '9',
    type: 1,
    nsfw: false,
    dm_permission: true,
    contexts: [0, 1, 2],
    integration_types: [0],
    name_localizations: null,
    description_localizations: null,
    default_member_permissions: json.default_member_permissions ?? null,
  };
}

function registry(current: readonly Record<string, unknown>[]): CommandRegistry & { replace: ReturnType<typeof vi.fn> } {
  return { fetch: vi.fn(async () => current), replace: vi.fn(async () => undefined) };
}

describe('diffCommands', () => {
  it('sees no difference between the local set and what Discord returns', () => {
    const diff = diffCommands([ban.toJSON(), ping.toJSON()], [registered(ping, '2'), registered(ban, '1')]);
    expect(diff).toMatchObject({ added: [], removed: [], changed: [], unchanged: ['ban', 'ping'], hasChanges: false });
  });

  it('detects an added command', () => {
    const diff = diffCommands([ban.toJSON(), ping.toJSON()], [registered(ban, '1')]);
    expect(diff).toMatchObject({ added: ['ping'], removed: [], changed: [], hasChanges: true });
  });

  it('detects a removed command', () => {
    const diff = diffCommands([ban.toJSON()], [registered(ban, '1'), registered(ping, '2')]);
    expect(diff).toMatchObject({ added: [], removed: ['ping'], changed: [], hasChanges: true });
  });

  it('detects an edited description, option and permission', () => {
    const edited = new SlashCommandBuilder().setName('ping').setDescription('Outra descrição');
    expect(diffCommands([edited.toJSON()], [registered(ping, '2')]).changed).toEqual(['ping']);

    const extraOption = new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bane um usuário do servidor')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((option) => option.setName('membro').setDescription('Usuário').setRequired(true))
      .addStringOption((option) => option.setName('motivo').setDescription('Motivo').setRequired(true));
    expect(diffCommands([extraOption.toJSON()], [registered(ban, '1')]).changed).toEqual(['ban']);

    const otherPermission = new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Mostra a latencia')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);
    expect(diffCommands([otherPermission.toJSON()], [registered(ping, '2')]).changed).toEqual(['ping']);
  });

  it('detects an option that was removed locally', () => {
    const fewer = new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bane um usuário do servidor')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((option) => option.setName('membro').setDescription('Usuário').setRequired(true));
    expect(diffCommands([fewer.toJSON()], [registered(ban, '1')]).changed).toEqual(['ban']);
  });

  it('treats two empty sets as equal', () => {
    expect(diffCommands([], []).hasChanges).toBe(false);
  });
});

describe('syncCommands', () => {
  it('writes nothing when no command changed', async () => {
    const port = registry([registered(ban, '1'), registered(ping, '2')]);
    const diff = await syncCommands(port, [ban.toJSON(), ping.toJSON()]);
    expect(diff.hasChanges).toBe(false);
    expect(port.replace).not.toHaveBeenCalled();
  });

  it('publishes once when a command was added', async () => {
    const port = registry([registered(ban, '1')]);
    await syncCommands(port, [ban.toJSON(), ping.toJSON()]);
    expect(port.replace).toHaveBeenCalledExactlyOnceWith([ban.toJSON(), ping.toJSON()]);
  });

  it('clears a removed command by replacing the set without it', async () => {
    const port = registry([registered(ban, '1'), registered(ping, '2')]);
    await syncCommands(port, [ban.toJSON()]);
    expect(port.replace).toHaveBeenCalledExactlyOnceWith([ban.toJSON()]);
  });

  it('clears the whole scope when the local set became empty', async () => {
    const port = registry([registered(ping, '2')]);
    await syncCommands(port, []);
    expect(port.replace).toHaveBeenCalledExactlyOnceWith([]);
  });

  it('does not touch an already empty scope', async () => {
    const port = registry([]);
    await syncCommands(port, []);
    expect(port.replace).not.toHaveBeenCalled();
  });

  it('publishes without differences only when forced', async () => {
    const port = registry([registered(ping, '2')]);
    await syncCommands(port, [ping.toJSON()], { force: true });
    expect(port.replace).toHaveBeenCalledOnce();
  });

  it('does not publish when reading the registry fails', async () => {
    const port = registry([]);
    port.fetch = vi.fn(async () => { throw new Error('discord down'); });
    await expect(syncCommands(port, [ping.toJSON()])).rejects.toThrow('discord down');
    expect(port.replace).not.toHaveBeenCalled();
  });
});
