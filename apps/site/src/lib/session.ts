import { useCallback, useEffect, useState } from 'react';

/** `bannerUrl` pode faltar (servidor sem banner ou sessão gravada antes do campo existir). */
type Guild = {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerUrl?: string | null;
  members: number | null;
  /** `false`: o bot não está no servidor; `null` ou ausente: não deu para saber. */
  botIn?: boolean | null;
  /** Convite do bot já apontado para este servidor; só vem quando `botIn` é `false`. */
  inviteUrl?: string | null;
};
type Bot = { id: string; name: string; avatarUrl: string | null };
type Session = { mock: boolean; discord: boolean; authenticated: boolean; user?: { label: string; avatarUrl: string | null }; guilds?: Guild[]; bot?: Bot };

async function callSession(path: string, method: 'GET' | 'POST'): Promise<Session | null> {
  try {
    const response = await fetch(path, { method, credentials: 'same-origin' });
    return response.ok ? ((await response.json()) as Session) : null;
  } catch {
    return null;
  }
}

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void callSession('/api/session', 'GET').then((current) => {
      if (current) setSession(current);
      else setFailed(true);
    });
  }, []);

  // Ao voltar para a aba (por exemplo depois de adicionar o bot a um servidor), relê a sessão em silêncio.
  useEffect(() => {
    const refresh = (): void => {
      if (document.visibilityState !== 'visible') return;
      void callSession('/api/session', 'GET').then((current) => { if (current) setSession(current); });
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const mockLogin = useCallback(async (): Promise<boolean> => {
    const current = await callSession('/api/mock-login', 'POST');
    if (current?.authenticated) setSession(current);
    return Boolean(current?.authenticated);
  }, []);
  const logout = useCallback(async (): Promise<void> => {
    const current = await callSession('/api/logout', 'POST');
    if (current) setSession(current);
  }, []);

  return { session, failed, mockLogin, logout };
}

export { useSession };
export type { Bot, Guild, Session };
