import type { ProductionEmojiDispatchPort } from '#bot/command-system/types.js';

const OWNER = 'AthosMontarroyos';
const REPO = 'KuruttinaBot';
const WORKFLOW_FILE = 'emoji-prod.yml';
const REF = 'main';

/** Página das execuções de `emoji-prod.yml`. A aprovação continua nesse ambiente. */
export const PRODUCTION_EMOJI_RUNS_URL =
  `https://github.com/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}`;

const DISPATCH_URL =
  `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

/**
 * Falha ao pedir o workflow. A mensagem é fixa: não carrega status, corpo,
 * URL da API nem o token, mesmo que a causa os contenha.
 */
export class ProductionEmojiDispatchError extends Error {
  readonly status: number | undefined;

  constructor(status?: number) {
    super('Não consegui pedir a criação agora. Tente de novo daqui a pouco.');
    this.name = 'ProductionEmojiDispatchError';
    this.status = status;
  }
}

export interface ProductionEmojiDispatchOptions {
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Dispara `workflow_dispatch` de `emoji-prod.yml` em `main`.
 * O token fica só no header e não entra em erro, URL ou log.
 */
export function createProductionEmojiDispatch(
  options: ProductionEmojiDispatchOptions,
): ProductionEmojiDispatchPort {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const token = options.token;
  return {
    async request({ name, source }) {
      let response: Response;
      try {
        response = await fetchImpl(DISPATCH_URL, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(20_000),
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'KuruttinaBot (production-emoji-dispatch)',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ ref: REF, inputs: { name, source } }),
        });
      } catch {
        throw new ProductionEmojiDispatchError();
      }
      if (response.status !== 204) {
        try { await response.body?.cancel(); } catch { /* o corpo não é diagnóstico */ }
        throw new ProductionEmojiDispatchError(response.status);
      }
      return { runsUrl: PRODUCTION_EMOJI_RUNS_URL };
    },
  };
}
