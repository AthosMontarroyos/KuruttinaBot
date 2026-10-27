import { describe, expect, it, vi } from 'vitest';
import { command as pingCommand } from '../apps/bot/src/commands/public/ping.js';
import { command as banCommand } from '../apps/bot/src/commands/mod/ban.js';
import { command as kickCommand } from '../apps/bot/src/commands/mod/kick.js';
import { command as timeoutCommand } from '../apps/bot/src/commands/mod/timeout.js';
import { command as untimeoutCommand } from '../apps/bot/src/commands/mod/untimeout.js';
import { command as unbanCommand } from '../apps/bot/src/commands/mod/unban.js';
import type {
  CommandContext,
  EmojiInfoLookup,
  GuildMemberProfile,
  MemberModerationPort,
  ModeratedUserProfile,
} from '../apps/bot/src/command-system/types.js';
import { createEmojiResolver } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import { createEmojiInfoExecutor } from '../apps/bot/src/infrastructure/discord/emojis/emojiInfo.js';
import { createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';

// Snapshot da saída ATUAL dos comandos de falas, gravado antes da migração
// para o catálogo de mensagens. Não use `-u` depois da primeira gravação.

const ACTOR = '111111111111111111';
const TARGET = '222222222222222222';
const BOT = '333333333333333333';
const OWNER = '444444444444444444';
const EMOJI_ID = '910000000000000001';
const CURRENT = '910000000000000005';

type EmojiMode = 'resolved' | 'unicode' | 'empty';

function emojiFor(mode: EmojiMode): CommandContext['emoji'] {
  if (mode === 'resolved') return async (name: string) => `<:${name}:${name}-id>`;
  if (mode === 'empty') return async () => '';
  // Fallback Unicode: o resolvedor real quando o Discord não responde.
  return createEmojiResolver({ emojis: { fetch: vi.fn().mockRejectedValue(new Error('Unavailable')) } });
}

function profile(id: string, name: string, position: number, timedOutUntil: number | null = null): GuildMemberProfile {
  return { id, displayName: name, highestRolePosition: position, administrator: false, timedOutUntil };
}

function moderation(targetName: string, actorName: string, targetIsBanned = false): MemberModerationPort {
  const members: Record<string, GuildMemberProfile> = {
    [ACTOR]: profile(ACTOR, actorName, 5),
    [TARGET]: profile(TARGET, targetName, 2, 4_102_444_800_000),
    [BOT]: profile(BOT, 'Kuruttina', 10),
    [OWNER]: profile(OWNER, 'Dono', 20),
  };
  const banned: ModeratedUserProfile = { id: TARGET, displayName: targetName };
  return {
    ownerId: OWNER,
    botUserId: BOT,
    fetchMember: async (userId: string) => (targetIsBanned && userId === TARGET ? null : members[userId] ?? null),
    kick: vi.fn(async () => 'kicked' as const),
    timeout: vi.fn(async () => 'timed-out' as const),
    clearTimeout: vi.fn(async () => 'cleared' as const),
    fetchUser: vi.fn(async () => null),
    fetchBan: vi.fn(async () => (targetIsBanned ? banned : null)),
    ban: vi.fn(async () => 'banned' as const),
    unban: vi.fn(async () => 'unbanned' as const),
  };
}

function context(overrides: Partial<CommandContext>): CommandContext {
  const allowed = { has: () => true };
  // O render usa o mesmo resolvedor de emojis do comando, como em produção.
  const emoji = overrides.emoji ?? emojiFor('resolved');
  return {
    userId: ACTOR,
    guildId: 'guild-id',
    apiPing: 42,
    gatewayPing: 87,
    render: createRenderer(emoji),
    acknowledge: vi.fn(async () => undefined),
    emoji,
    reply: vi.fn(async () => undefined),
    sendMessage: vi.fn(async () => undefined),
    deleteReply: vi.fn(async () => undefined),
    memberPermissions: allowed,
    appPermissions: allowed,
    textChannel: {
      isThread: false,
      fetchMessages: async () => [],
      bulkDelete: async () => 0,
      deleteMessage: async () => false,
    },
    ...overrides,
  };
}

/** Tudo o que o comando publicou: respostas e mensagens enviadas. */
function published(ctx: CommandContext) {
  return {
    reply: (ctx.reply as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as unknown),
    sendMessage: (ctx.sendMessage as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as unknown),
  };
}

interface ModCase {
  readonly name: string;
  readonly command: { readonly execute: (context: CommandContext) => Promise<void> };
  /** Argumentos depois da menção do alvo. */
  readonly rest: string;
  readonly targetIsBanned?: boolean;
}

const moderationCases: readonly ModCase[] = [
  { name: 'ban', command: banCommand, rest: '' },
  { name: 'kick', command: kickCommand, rest: '' },
  { name: 'timeout', command: timeoutCommand, rest: '10m' },
  { name: 'untimeout', command: untimeoutCommand, rest: '' },
  { name: 'unban', command: unbanCommand, rest: '', targetIsBanned: true },
];

async function runModeration(
  entry: ModCase,
  options: { emoji?: EmojiMode; targetName?: string; actorName?: string; rest?: string },
) {
  const ctx = context({
    emoji: emojiFor(options.emoji ?? 'resolved'),
    memberModeration: moderation(options.targetName ?? 'Alvo', options.actorName ?? 'Mod', entry.targetIsBanned),
    rawArgs: `<@${TARGET}> ${options.rest ?? entry.rest}`.trimEnd(),
  });
  await entry.command.execute(ctx);
  return published(ctx);
}

describe('snapshot do catálogo de falas: ping', () => {
  it.each(['resolved', 'unicode', 'empty'] as const)('publica o ping com emojis %s', async (mode) => {
    const ctx = context({ emoji: emojiFor(mode) });
    await pingCommand.execute(ctx);
    expect(published(ctx)).toMatchSnapshot();
  });
});

describe.each(moderationCases)('snapshot do catálogo de falas: $name', (entry) => {
  it.each(['resolved', 'unicode', 'empty'] as const)('confirma sem motivo com emojis %s', async (mode) => {
    expect(await runModeration(entry, { emoji: mode })).toMatchSnapshot();
  });

  it('confirma com motivo claro', async () => {
    const rest = entry.rest === '' ? 'motivo claro' : `${entry.rest} motivo claro`;
    expect(await runModeration(entry, { rest })).toMatchSnapshot();
  });

  it('confirma com motivo que fica vazio depois da limpeza', async () => {
    const rest = entry.rest === '' ? '``' : `${entry.rest} \`\``;
    expect(await runModeration(entry, { rest })).toMatchSnapshot();
  });

  it.each([
    ['asterisco e sublinhado', 'a*b_c'],
    ['crase', 'Al`vo'],
    ['everyone', '@everyone'],
    ['menção', '<@1>'],
    ['só espaços', '   '],
  ])('limpa o nome com %s', async (_label, name) => {
    expect(await runModeration(entry, { targetName: name, actorName: name })).toMatchSnapshot();
  });

  it('limpa o motivo com caracteres especiais', async () => {
    const rest = entry.rest === '' ? 'a*b_c `x` @everyone <@1>' : `${entry.rest} a*b_c \`x\` @everyone <@1>`;
    expect(await runModeration(entry, { rest })).toMatchSnapshot();
  });
});

describe('snapshot do catálogo de falas: timeout com várias unidades', () => {
  it.each([
    ['1 hora e 30 minutos', '1 hora e 30 minutos'],
    ['4 semanas', '4 semanas'],
    ['1 semana, 2 dias', '1 semana, 2 dias'],
    ['1d2h3m4s', '1d2h3m4s'],
  ])('formata a duração %s', async (_label, duration) => {
    const entry = moderationCases.find((candidate) => candidate.name === 'timeout');
    if (entry === undefined) throw new Error('caso timeout ausente');
    expect(await runModeration(entry, { rest: `${duration} aviso` })).toMatchSnapshot();
  });
});

describe('snapshot do catálogo de falas: emojiInfo', () => {
  async function run(options: {
    name: string;
    emoji: EmojiMode;
    lookup: EmojiInfoLookup;
    withPort?: boolean;
  }) {
    const reply = vi.fn(async (_content: unknown) => undefined);
    await createEmojiInfoExecutor()({
      apiPing: 0,
      gatewayPing: 0,
      render: createRenderer(emojiFor(options.emoji)),
      acknowledge: vi.fn(async () => undefined),
      emoji: emojiFor(options.emoji),
      reply,
      guildId: CURRENT,
      rawArgs: `<:${options.name}:${EMOJI_ID}>`,
      ...(options.withPort === false ? {} : { emojiInfo: { lookup: async () => options.lookup } }),
    });
    return reply.mock.calls.map((call) => call[0]);
  }

  it.each(['resolved', 'unicode', 'empty'] as const)('publica a ficha com emojis %s', async (mode) => {
    expect(await run({ name: 'wave', emoji: mode, lookup: { status: 'unconfirmed' } })).toMatchSnapshot();
  });

  it('publica a ficha de um emoji com sublinhado no nome', async () => {
    expect(await run({ name: 'a_b_c', emoji: 'resolved', lookup: { status: 'unconfirmed' } })).toMatchSnapshot();
  });

  it.each(['resolved', 'unicode', 'empty'] as const)('avisa uso inválido, consulta indisponível e sem porta com emojis %s', async (mode) => {
    const invalid = await run({ name: 'x', emoji: mode, lookup: { status: 'unconfirmed' } });
    const unavailable = await run({ name: 'wave', emoji: mode, lookup: { status: 'unavailable' } });
    const noPort = await run({ name: 'wave', emoji: mode, lookup: { status: 'unconfirmed' }, withPort: false });
    expect({ invalid, unavailable, noPort }).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Extensão do snapshot: recusas, erros, durações inválidas, slash e emojis em falha.
// O prefixo `k!` é removido antes do comando, então a entrada por prefixo é `rawArgs`.
// ---------------------------------------------------------------------------

interface Scenario {
  readonly label: string;
  readonly target?: string;
  readonly reason?: string;
  readonly userDenied?: boolean;
  readonly botDenied?: boolean;
  readonly guildOnly?: boolean;
  readonly targetMissing?: boolean;
  readonly targetRank?: number;
  readonly botRank?: number;
  readonly administrator?: boolean;
  readonly noActiveTimeout?: boolean;
  readonly notBanned?: boolean;
  readonly alreadyBanned?: boolean;
  readonly discordFails?: boolean;
  readonly fetchFails?: boolean;
  readonly unknownOutcome?: boolean;
}

function throwing(): never {
  throw Object.assign(new Error('Missing Permissions'), { code: 50013 });
}

function scenarioPort(entry: ModCase, scenario: Scenario): MemberModerationPort {
  const members: Record<string, GuildMemberProfile> = {
    [ACTOR]: profile(ACTOR, 'Mod', 5),
    [TARGET]: {
      ...profile(TARGET, 'Alvo', scenario.targetRank ?? 2, scenario.noActiveTimeout === true ? null : 4_102_444_800_000),
      administrator: scenario.administrator === true,
    },
    [BOT]: profile(BOT, 'Kuruttina', scenario.botRank ?? 10),
    [OWNER]: profile(OWNER, 'Dono', 20),
  };
  const known: ModeratedUserProfile = { id: TARGET, displayName: 'Fora' };
  // O unban só age sobre quem não é membro; o ban "já banido" também.
  const unbanTarget = entry.name === 'unban' && scenario.notBanned !== true;
  const hideMember = scenario.targetMissing === true || scenario.alreadyBanned === true || unbanTarget;
  return {
    ownerId: OWNER,
    botUserId: BOT,
    fetchMember: async (userId: string) => {
      if (scenario.fetchFails === true && userId === TARGET) return throwing();
      if (userId === TARGET && hideMember) return null;
      return members[userId] ?? null;
    },
    kick: vi.fn(async () => (scenario.discordFails === true ? throwing() : 'kicked' as const)),
    timeout: vi.fn(async () => {
      if (scenario.discordFails === true) return throwing();
      return scenario.unknownOutcome === true ? 'missing' as const : 'timed-out' as const;
    }),
    clearTimeout: vi.fn(async () => {
      if (scenario.discordFails === true) return throwing();
      return scenario.unknownOutcome === true ? 'missing' as const : 'cleared' as const;
    }),
    fetchUser: vi.fn(async () => (entry.name === 'ban' && scenario.targetMissing !== true ? known : null)),
    fetchBan: vi.fn(async () => (unbanTarget || scenario.alreadyBanned === true ? known : null)),
    ban: vi.fn(async () => {
      if (scenario.discordFails === true) return throwing();
      return scenario.unknownOutcome === true ? 'unknown-user' as const : 'banned' as const;
    }),
    unban: vi.fn(async () => {
      if (scenario.discordFails === true) return throwing();
      return scenario.unknownOutcome === true ? 'not-banned' as const : 'unbanned' as const;
    }),
  };
}

async function runScenario(entry: ModCase, scenario: Scenario, mode: EmojiMode, via: 'prefix' | 'slash' = 'prefix') {
  const target = scenario.target ?? TARGET;
  const reason = scenario.reason ?? '';
  const rawArgs = [target === '' ? '' : `<@${target}>`, entry.name === 'timeout' ? '10m' : '', reason]
    .filter((part) => part !== '')
    .join(' ');
  const base: Partial<CommandContext> = {
    emoji: emojiFor(mode),
    memberModeration: scenarioPort(entry, scenario),
    ...(scenario.userDenied === true ? { memberPermissions: { has: () => false } } : {}),
    ...(scenario.botDenied === true ? { appPermissions: { has: () => false } } : {}),
    ...(scenario.guildOnly === true ? { guildId: undefined } : {}),
  };
  const ctx = via === 'slash'
    ? context({
      ...base,
      options: [
        { name: 'membro', value: target },
        ...(entry.name === 'timeout' ? [{ name: 'duracao', value: '1 hora e 30 minutos' }] : []),
        ...(reason === '' ? [] : [{ name: 'motivo', value: reason }]),
      ],
    })
    : context({ ...base, rawArgs });
  await entry.command.execute(ctx);
  return published(ctx);
}

const scenarios: readonly Scenario[] = [
  { label: 'permissão negada ao autor', userDenied: true },
  { label: 'permissão do bot ausente', botDenied: true },
  { label: 'fora de servidor', guildOnly: true },
  { label: 'sem alvo', target: '' },
  { label: 'alvo inválido', target: 'pessoa' },
  { label: 'motivo longo', reason: 'x'.repeat(201) },
  { label: 'autoação', target: ACTOR },
  { label: 'bot como alvo', target: BOT },
  { label: 'dono do servidor', target: OWNER },
  { label: 'cargo do autor igual', targetRank: 5 },
  { label: 'cargo do bot igual', botRank: 2 },
  { label: 'administrador', administrator: true },
  { label: 'membro ausente', targetMissing: true },
  { label: 'sem castigo ativo', noActiveTimeout: true },
  { label: 'sem banimento', notBanned: true },
  { label: 'já banido', alreadyBanned: true },
  { label: 'resultado desconhecido', unknownOutcome: true },
  { label: 'falha do Discord', discordFails: true },
  { label: 'falha ao buscar o membro', fetchFails: true },
];

describe.each(moderationCases)('snapshot estendido: $name', (entry) => {
  it.each(scenarios.map((scenario) => [scenario.label, scenario] as const))('recusa/erro: %s', async (_label, scenario) => {
    expect(await runScenario(entry, scenario, 'resolved')).toMatchSnapshot();
  });

  it.each(['unicode', 'empty'] as const)('todos os emojis falhando (%s): recusa, erro e confirmação', async (mode) => {
    expect({
      autoacao: await runScenario(entry, { label: 'a', target: ACTOR }, mode),
      falha: await runScenario(entry, { label: 'b', discordFails: true }, mode),
      motivoLongo: await runScenario(entry, { label: 'c', reason: 'x'.repeat(201) }, mode),
      permissao: await runScenario(entry, { label: 'd', userDenied: true }, mode),
      confirmacao: await runScenario(entry, { label: 'e' }, mode),
    }).toMatchSnapshot();
  });

  it.each(['resolved', 'unicode'] as const)('entrada por slash com emojis %s', async (mode) => {
    expect({
      confirmacao: await runScenario(entry, { label: 's' }, mode, 'slash'),
      comMotivo: await runScenario(entry, { label: 's', reason: 'motivo claro' }, mode, 'slash'),
      autoacao: await runScenario(entry, { label: 's', target: ACTOR }, mode, 'slash'),
    }).toMatchSnapshot();
  });
});

describe('snapshot estendido: timeout com duração inválida', () => {
  it.each([
    ['sem duração', ''],
    ['duração inválida', '10motivo'],
    ['curta (menos de 1 segundo)', '0s'],
    ['longa (mais de 28 dias)', '28d1s'],
    ['longa em semanas', '5w'],
  ])('recusa a duração %s', async (_label, duration) => {
    const run = async (mode: EmojiMode) => {
      const ctx = context({
        emoji: emojiFor(mode),
        memberModeration: moderation('Alvo', 'Mod'),
        rawArgs: `<@${TARGET}> ${duration}`.trimEnd(),
      });
      await timeoutCommand.execute(ctx);
      return published(ctx);
    };
    expect({ resolved: await run('resolved'), unicode: await run('unicode'), empty: await run('empty') }).toMatchSnapshot();
  });

  it('recusa duração curta pelo slash', async () => {
    const ctx = context({
      memberModeration: moderation('Alvo', 'Mod'),
      options: [{ name: 'membro', value: TARGET }, { name: 'duracao', value: '0s' }],
    });
    await timeoutCommand.execute(ctx);
    expect(published(ctx)).toMatchSnapshot();
  });
});

describe('snapshot estendido: ping completo', () => {
  it('publica latências altas e zeradas', async () => {
    const high = context({ apiPing: 1234, gatewayPing: 5678 });
    const zero = context({ apiPing: 0, gatewayPing: 0, emoji: emojiFor('unicode') });
    await pingCommand.execute(high);
    await pingCommand.execute(zero);
    expect({ high: published(high), zero: published(zero) }).toMatchSnapshot();
  });
});

describe('snapshot estendido: emojiInfo', () => {
  async function run(options: {
    emoji: EmojiMode;
    rawArgs?: string;
    options?: ReadonlyArray<{ readonly name: string; readonly value?: unknown }>;
    lookup: EmojiInfoLookup;
  }) {
    const reply = vi.fn(async (_content: unknown) => undefined);
    await createEmojiInfoExecutor()({
      apiPing: 0,
      gatewayPing: 0,
      render: createRenderer(emojiFor(options.emoji)),
      acknowledge: vi.fn(async () => undefined),
      emoji: emojiFor(options.emoji),
      reply,
      guildId: CURRENT,
      ...(options.rawArgs === undefined ? {} : { rawArgs: options.rawArgs }),
      ...(options.options === undefined ? {} : { options: options.options }),
      emojiInfo: { lookup: async () => options.lookup },
    });
    return reply.mock.calls.map((call) => call[0]);
  }

  it.each(['resolved', 'unicode', 'empty'] as const)('uso inválido sem marcação com emojis %s', async (mode) => {
    expect({
      vazio: await run({ emoji: mode, rawArgs: '', lookup: { status: 'unconfirmed' } }),
      texto: await run({ emoji: mode, rawArgs: 'oi', lookup: { status: 'unconfirmed' } }),
      dois: await run({ emoji: mode, rawArgs: `<:a_b:${EMOJI_ID}> <:c_d:${EMOJI_ID}>`, lookup: { status: 'unconfirmed' } }),
      slash: await run({ emoji: mode, options: [{ name: 'emoji', value: 'oi' }], lookup: { status: 'unconfirmed' } }),
    }).toMatchSnapshot();
  });

  it.each(['resolved', 'unicode', 'empty'] as const)('indisponível com emojis %s', async (mode) => {
    expect(await run({ emoji: mode, rawArgs: `<:wave:${EMOJI_ID}>`, lookup: { status: 'unavailable' } })).toMatchSnapshot();
  });

  it.each(['resolved', 'unicode'] as const)('variante animada com emojis %s', async (mode) => {
    expect({
      naoConfirmado: await run({ emoji: mode, rawArgs: `<a:dance_now:${EMOJI_ID}>`, lookup: { status: 'unconfirmed' } }),
      confirmadoEstatico: await run({
        emoji: mode,
        rawArgs: `<a:dance_now:${EMOJI_ID}>`,
        lookup: { status: 'confirmed', name: 'dance_now', animated: false, guildName: 'Atual' },
      }),
      confirmadoAnimado: await run({
        emoji: mode,
        options: [{ name: 'emoji', value: `<a:dance_now:${EMOJI_ID}>` }],
        lookup: { status: 'confirmed', name: 'dance_now', animated: true, guildName: 'Atual' },
      }),
    }).toMatchSnapshot();
  });
});
