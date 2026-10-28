import { useCallback, useEffect, useState } from 'react';

type Guild = { id: string; name: string; iconUrl: string | null; members: number | null };
type Session = { mock: boolean; discord: boolean; authenticated: boolean; user?: { label: string; avatarUrl: string | null }; guilds?: Guild[] };

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
export type { Guild, Session };
