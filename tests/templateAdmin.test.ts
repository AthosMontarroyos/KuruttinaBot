import { describe, expect, it, vi } from 'vitest';
import {
  createTemplateAdminService,
  extractComponents,
  TemplateAdminError,
  type MessageTemplate,
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
    folderId: null,
    folderName: null,
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
    move: vi.fn().mockResolvedValue({ ok: true }),
    listFolders: vi.fn().mockResolvedValue([]),
    createFolder: vi.fn().mockResolvedValue({ ok: true, id: 1 }),
    renameFolder: vi.fn().mockResolvedValue({ ok: true }),
    removeFolder: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('extractComponents', () => {
  it('coleta ação de botão e de opção de menu, ignorando quem não tem ação e botão de link', () => {
    const template: MessageTemplate = {
      embeds: [],
      components: [
        {
          kind: 'buttons',
          buttons: [
            { style: 'link', label: 'Site', url: 'https://example.com' },
            { style: 'primary', label: 'Sem ação', customId: 'kt:btn:sem' },
            { style: 'primary', label: 'Com ação', customId: 'kt:btn:com', action: { type: 'delete' } },
          ],
        },
        {
          kind: 'select',
          menu: {
            customId: 'kt:menu:roles',
            options: [
              { label: 'Sem ação', value: 'a' },
              { label: 'Com ação', value: 'b', action: { type: 'reply', template: 'oi' } },
            ],
          },
        },
      ],
    };

    expect(extractComponents(template)).toEqual([
      { customId: 'kt:btn:com', kind: 'button', action: { type: 'delete' } },
      { customId: 'kt:menu:roles', kind: 'select_option', action: { type: 'reply', template: 'oi' } },
    ]);
  });

  it('devolve lista vazia quando nenhum componente tem ação', () => {
    const template: MessageTemplate = {
      embeds: [],
      components: [{ kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: 'kt:btn:x' }] }],
    };
    expect(extractComponents(template)).toEqual([]);
  });
});

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
        expect.objectContaining({
          guildId: 'g1', name: 'welcome', buttonCount: 1, menuCount: 1, actorId: 'u1',
          components: extractComponents(validTemplate as MessageTemplate),
        }),
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

    it('mapeia custom_id duplicado do repositório', async () => {
      const repository = makeRepository({ create: vi.fn().mockResolvedValue({ ok: false, code: 'duplicate_custom_id' }) });
      const service = createTemplateAdminService(repository);
      await expect(
        service.createTemplate({ guildId: 'g1', name: 'welcome', contentJson: JSON.stringify(validTemplate), actorId: 'u1' }),
      ).rejects.toMatchObject({ code: 'duplicate_custom_id' });
    });

    it('repassa folderId ao repositório', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      vi.mocked(repository.get).mockResolvedValueOnce(makeRecord());
      await service.createTemplate({
        guildId: 'g1', name: 'welcome', contentJson: JSON.stringify(validTemplate), actorId: 'u1', folderId: 7,
      });
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ folderId: 7 }));
    });

    it('mapeia invalid_folder do repositório', async () => {
      const repository = makeRepository({ create: vi.fn().mockResolvedValue({ ok: false, code: 'invalid_folder' }) });
      const service = createTemplateAdminService(repository);
      await expect(
        service.createTemplate({ guildId: 'g1', name: 'welcome', contentJson: JSON.stringify(validTemplate), actorId: 'u1', folderId: 999 }),
      ).rejects.toMatchObject({ code: 'invalid_folder' });
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
        expect.objectContaining({
          guildId: 'g1', name: 'welcome', expectedVersion: 1, buttonCount: 1, menuCount: 1,
          components: extractComponents(validTemplate as MessageTemplate),
        }),
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

    it('repassa folderId ao repositório e mapeia invalid_folder', async () => {
      const previous = makeRecord();
      const repository = makeRepository({
        get: vi.fn().mockResolvedValueOnce(previous).mockResolvedValueOnce(makeRecord({ version: 2 })),
      });
      const service = createTemplateAdminService(repository);
      await service.updateTemplate({
        guildId: 'g1', name: 'welcome', expectedVersion: 1, contentJson: JSON.stringify(validTemplate), actorId: 'u1', folderId: 3,
      });
      expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({ folderId: 3 }));

      const repositoryInvalid = makeRepository({
        get: vi.fn().mockResolvedValue(previous),
        update: vi.fn().mockResolvedValue({ ok: false, code: 'invalid_folder' }),
      });
      const serviceInvalid = createTemplateAdminService(repositoryInvalid);
      await expect(
        serviceInvalid.updateTemplate({
          guildId: 'g1', name: 'welcome', expectedVersion: 1, contentJson: JSON.stringify(validTemplate), actorId: 'u1', folderId: 999,
        }),
      ).rejects.toMatchObject({ code: 'invalid_folder' });
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

  describe('moveTemplate', () => {
    it('delega ao repositório e repassa folderId', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      await service.moveTemplate('g1', 'welcome', 7);
      expect(repository.move).toHaveBeenCalledWith('g1', 'welcome', 7);
    });

    it('aceita folderId null para desarquivar', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      await service.moveTemplate('g1', 'welcome', null);
      expect(repository.move).toHaveBeenCalledWith('g1', 'welcome', null);
    });

    it('lança not_found quando o template não existe', async () => {
      const repository = makeRepository({ move: vi.fn().mockResolvedValue({ ok: false, code: 'not_found' }) });
      const service = createTemplateAdminService(repository);
      await expect(service.moveTemplate('g1', 'welcome', 1)).rejects.toMatchObject({ code: 'not_found' });
    });

    it('lança invalid_folder quando a pasta é de outro servidor', async () => {
      const repository = makeRepository({ move: vi.fn().mockResolvedValue({ ok: false, code: 'invalid_folder' }) });
      const service = createTemplateAdminService(repository);
      await expect(service.moveTemplate('g1', 'welcome', 1)).rejects.toMatchObject({ code: 'invalid_folder' });
    });
  });

  describe('pastas', () => {
    it('listFolders delega direto ao repositório', async () => {
      const repository = makeRepository({ listFolders: vi.fn().mockResolvedValue([{ id: 1, name: 'Boas-vindas', createdAt: '2026-01-01T00:00:00.000Z' }]) });
      const service = createTemplateAdminService(repository);
      await expect(service.listFolders('g1')).resolves.toEqual([{ id: 1, name: 'Boas-vindas', createdAt: '2026-01-01T00:00:00.000Z' }]);
      expect(repository.listFolders).toHaveBeenCalledWith('g1');
    });

    it('createFolder rejeita nome vazio, com espaço nas pontas ou maior que 50', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      for (const name of ['', ' x', 'x ', 'a'.repeat(51)]) {
        await expect(service.createFolder('g1', name)).rejects.toMatchObject({ code: 'invalid_folder_name' });
      }
      expect(repository.createFolder).not.toHaveBeenCalled();
    });

    it('createFolder cria com sucesso', async () => {
      const repository = makeRepository({ createFolder: vi.fn().mockResolvedValue({ ok: true, id: 5 }) });
      const service = createTemplateAdminService(repository);
      await expect(service.createFolder('g1', 'Eventos')).resolves.toEqual({ id: 5, name: 'Eventos' });
      expect(repository.createFolder).toHaveBeenCalledWith('g1', 'Eventos');
    });

    it('createFolder mapeia duplicata e cota do repositório', async () => {
      const dup = makeRepository({ createFolder: vi.fn().mockResolvedValue({ ok: false, code: 'duplicate' }) });
      await expect(createTemplateAdminService(dup).createFolder('g1', 'Eventos')).rejects.toMatchObject({ code: 'duplicate_folder' });

      const quota = makeRepository({ createFolder: vi.fn().mockResolvedValue({ ok: false, code: 'quota' }) });
      await expect(createTemplateAdminService(quota).createFolder('g1', 'Eventos')).rejects.toMatchObject({ code: 'quota' });
    });

    it('renameFolder rejeita nome inválido e repassa not_found/duplicate', async () => {
      const repository = makeRepository();
      const service = createTemplateAdminService(repository);
      await expect(service.renameFolder('g1', 1, ' x')).rejects.toMatchObject({ code: 'invalid_folder_name' });
      expect(repository.renameFolder).not.toHaveBeenCalled();

      const notFound = makeRepository({ renameFolder: vi.fn().mockResolvedValue({ ok: false, code: 'not_found' }) });
      await expect(createTemplateAdminService(notFound).renameFolder('g1', 1, 'Novo')).rejects.toMatchObject({ code: 'folder_not_found' });

      const dup = makeRepository({ renameFolder: vi.fn().mockResolvedValue({ ok: false, code: 'duplicate' }) });
      await expect(createTemplateAdminService(dup).renameFolder('g1', 1, 'Novo')).rejects.toMatchObject({ code: 'duplicate_folder' });

      const success = makeRepository({ renameFolder: vi.fn().mockResolvedValue({ ok: true }) });
      await expect(createTemplateAdminService(success).renameFolder('g1', 1, 'Novo')).resolves.toBeUndefined();
      expect(success.renameFolder).toHaveBeenCalledWith('g1', 1, 'Novo');
    });

    it('removeFolder é idempotente, sem lançar quando a pasta já não existe', async () => {
      const repository = makeRepository({ removeFolder: vi.fn().mockResolvedValue(false) });
      const service = createTemplateAdminService(repository);
      await expect(service.removeFolder('g1', 1)).resolves.toBeUndefined();
      expect(repository.removeFolder).toHaveBeenCalledWith('g1', 1);
    });
  });
});
