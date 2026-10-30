import type { IncomingMessage, ServerResponse } from 'node:http';
import { isDiscordId } from '@kuruttina/database';

const dashboardServerPath = /^\/dashboard\/([1-9][0-9]{16,19})$/u;

/** ID do Discord no formato aceito pelo banco: snowflake ASCII dentro de uint64. */
export function isDiscordSnowflake(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return isDiscordId(value);
  } catch {
    return false;
  }
}

export function isDashboardServerPath(path: string): boolean {
  const id = dashboardServerPath.exec(path)?.[1];
  return id !== undefined && isDiscordSnowflake(id);
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string | string[]> = {},
): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(body));
}

/** Lê o corpo JSON com teto de bytes. Corpo vazio vira `undefined`; JSON inválido ou excesso lança. */
export async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text.trim() === '' ? undefined : JSON.parse(text);
}
