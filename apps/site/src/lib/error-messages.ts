/** Frases iguais em todas as telas do painel quando a API recusa ou não responde. */
const sessionExpired = 'Sua sessão expirou. Entre de novo para continuar.';
const serverUnavailable = 'Não foi possível falar com o servidor agora.';

const shared: Record<string, string> = {
  unauthenticated: sessionExpired,
  unavailable: serverUnavailable,
};

/** Usa a frase específica do código, senão a compartilhada, senão a de servidor indisponível. */
function errorText(code: string, specific: Partial<Record<string, string>> = {}): string {
  return specific[code] ?? shared[code] ?? serverUnavailable;
}

export { errorText, serverUnavailable, sessionExpired };
