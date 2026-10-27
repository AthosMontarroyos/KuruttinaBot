import { describe, expect, it, vi } from 'vitest';
import {
  createTemplateAdminService,
  TemplateAdminError,
  type TemplateRecord,
  type TemplateRepositoryPort,
  type GuildUsage,
} from '@kuruttina/message-templates';

const validTemplate = {
  content: 'Olá!',
  embeds: [],
  components: [
    { kind: 'buttons', buttons: [{ style: 'primary', label: 'Ok', customId: 'kt:welcome:abc-1' }] },
    { kind: 'select', menu: { customId: 'kt:menu:roles', options: [{ label: 'A', value: 'a' }] } },
  ],
};

function makeRecord(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    name: 'welcome',
    content: validTemplate,
    buttonCount: 1,
    menuCount: 1,
    version: 1,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepository(overrides: Partial<TemplateRepositoryPort> = {}): TemplateRepositoryPort {
  const usage: GuildUsage = { templates: 1, buttons: 0, menus: 0 };
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    usage: vi.fn().mockResolvedValue(usage),
    create: vi.fn().mockResolvedValue({ ok: true }),
    update: vi.fn().mockResolvedValue({ ok: true, version: 2 }),
    remove: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('createTemplateAdminService', () => {
  describe('createTemplate', () => {
    it('rejeita nome inválido', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      await expect(
        service.createTemplate({ guildId: 'g1', name: 'Nome Inválido!', contentJson: JSON.stringify(validTemplate), actorId: 'u1' }),
      ).rejects.toMatchObject({ code: 'invalid_name' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita JSON acima de 32768 bytes', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      const big = JSON.stringify({ content: 'a'.repeat(33000), embeds: [], components: [] });
      await expect(
        service.createTemplate({ guildId: 'g1', name: 'welcome', contentJson: big, actorId: 'u1' }),
      ).rejects.toMatchObject({ code: 'too_large' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita JSON inválido', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      await expect(
        service.createTemplate({ guildId: 'g1', name: 'welcome', contentJson: '{not json', actorId: 'u1' }),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita template que falha validateTemplate (11 embeds)', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      const invalid = { embeds: Array.from({ length: 11 }, () => ({ title: 'x' })), components: [] };
      let caught: unknown;
      try {
        await service.createTemplate({ guildId: 'g1', name: 'welcome', contentJson: JSON.stringify(invalid), actorId: 'u1' });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(TemplateAdminError);
      expect((caught as TemplateAdminError).code).toBe('validation');
      expect((caught as TemplateAdminError).details?.map((d) => d.code)).toContain('too_many_embeds');
    });

    it('cria com sucesso chamando repository.create com buttonCount/menuCount corretos', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      vi.mocked(repository.get).mockResolvedValueOnce(makeRecord());

      const record = await service.createTemplate({
        guildId: 'g1',
        name: 'welcome',
        contentJson: JSON.stringify(validTemplate),
        actorId: 'u1',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: 'g1', name: 'welcome', buttonCount: 1, menuCount: 1, actorId: 'u1' }),
      );
      expect(record.name).toBe('welcome');
    });

    it('mapeia duplicata do repositório', async () => {
      const repository = makeRepository({ create: vi.fn().mockResolvedValue({ ok: false, code: 'duplicate' }) });
      const service = createTemplateAdminService(repository);
      await expect(
        service.createTemplate({ guildId: 'g1', name: 'welcome', contentJson: JSON.stringify(validTemplate), actorId: 'u1' }),
      ).rejects.toMatchObject({ code: 'duplicate' });
    });

    it('mapeia cota do repositório', async () => {
      const repository = makeRepository({ create: vi.fn().mockResolvedValue({ ok: false, code: 'quota' }) });
      const service = createTemplateAdminService(repository);
      await expect(
        service.createTemplate({ guildId: 'g1', name: 'welcome', contentJson: JSON.stringify(validTemplate), actorId: 'u1' }),
      ).rejects.toMatchObject({ code: 'quota' });
    });

    it('rejeita por cota quando o uso atual já atingiu o limite de templates', async () => {
      const repository = makeRepository({ usage: vi.fn().mockResolvedValue({ templates: 100, buttons: 0, menus: 0 }) });
      const service = createTemplateAdminService(repository);
      await expect(
        service.createTemplate({ guildId: 'g1', name: 'welcome', contentJson: JSON.stringify(validTemplate), actorId: 'u1' }),
      ).rejects.toMatchObject({ code: 'quota' });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTemplate', () => {
    it('edita com sucesso subtraindo o uso antigo', async () => {
      const previous = makeRecord({ buttonCount: 3, menuCount: 2 });
      const repository = makeRepository({
        get: vi.fn().mockResolvedValueOnce(previous).mockResolvedValueOnce(makeRecord({ version: 2 })),
        usage: vi.fn().mockResolvedValue({ templates: 100, buttons: 50, menus: 50 }),
      });
      const service = createTemplateAdminService(repository);

      const record = await service.updateTemplate({
        guildId: 'g1',
        name: 'welcome',
        expectedVersion: 1,
        contentJson: JSON.stringify(validTemplate),
        actorId: 'u1',
      });

      // uso sem este template: buttons 50-3=47, menus 50-2=48; adicionando 1 e 1 fica dentro do limite de 50.
      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: 'g1', name: 'welcome', expectedVersion: 1, buttonCount: 1, menuCount: 1 }),
      );
      expect(record.version).toBe(2);
    });

    it('edição não é recusada por limite de templates mesmo no teto', async () => {
      const previous = makeRecord({ buttonCount: 0, menuCount: 0 });
      const repository = makeRepository({
        get: vi.fn().mockResolvedValueOnce(previous).mockResolvedValueOnce(makeRecord()),
        usage: vi.fn().mockResolvedValue({ templates: 100, buttons: 0, menus: 0 }),
      });
      const service = createTemplateAdminService(repository);

      await expect(
        service.updateTemplate({
          guildId: 'g1',
          name: 'welcome',
          expectedVersion: 1,
          contentJson: JSON.stringify(validTemplate),
          actorId: 'u1',
        }),
      ).resolves.toBeDefined();
    });

    it('edição em template inexistente dá not_found', async () => {
      const repository = makeRepository({ get: vi.fn().mockResolvedValue(null) });
      const service = createTemplateAdminService(repository);
      await expect(
        service.updateTemplate({
          guildId: 'g1',
          name: 'welcome',
          expectedVersion: 1,
          contentJson: JSON.stringify(validTemplate),
          actorId: 'u1',
        }),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('mapeia conflict do repositório', async () => {
      const previous = makeRecord();
      const repository = makeRepository({
        get: vi.fn().mockResolvedValue(previous),
        update: vi.fn().mockResolvedValue({ ok: false, code: 'conflict' }),
      });
      const service = createTemplateAdminService(repository);
      await expect(
        service.updateTemplate({
          guildId: 'g1',
          name: 'welcome',
          expectedVersion: 1,
          contentJson: JSON.stringify(validTemplate),
          actorId: 'u1',
        }),
      ).rejects.toMatchObject({ code: 'conflict' });
    });
  });

  describe('listTemplates, getTemplate e removeTemplate', () => {
    it('delegam direto ao repositório', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);

      await service.listTemplates('g1', { limit: 10 });
      expect(repository.list).toHaveBeenCalledWith('g1', { limit: 10 });

      const result = await service.getTemplate('g1', 'welcome');
      expect(result).toBeNull();

      await service.removeTemplate('g1', 'welcome');
      expect(repository.remove).toHaveBeenCalledWith('g1', 'welcome');
    });
  });
});
