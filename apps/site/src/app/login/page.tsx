'use client';

import { useEffect, useState } from 'react';
import type { Session } from '../../lib/session';

type LoginPageProps = {
  session: Session | null;
  failed: boolean;
  onMockLogin: () => Promise<boolean>;
};

const primaryButton = 'inline-flex min-h-12 items-center justify-center rounded-[10px] border-0 bg-button px-5 text-[15px] font-semibold text-button-text hover:bg-secondary';
const outlineButton = 'inline-flex min-h-12 items-center justify-center rounded-[10px] border border-control bg-transparent px-5 text-[15px] font-medium text-text hover:bg-surface disabled:opacity-60';

function errorMessage(code: string | null): string {
  if (code === 'indisponivel') return 'O login com Discord não está disponível agora. Tente de novo mais tarde.';
  if (code) return 'Não foi possível entrar com o Discord. Tente de novo.';
  return '';
}

function LoginPage({ session, failed, onMockLogin }: LoginPageProps) {
  const [error, setError] = useState(() => errorMessage(new URLSearchParams(location.search).get('erro')));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.authenticated) location.replace('/dashboard');
  }, [session?.authenticated]);

  const mockLogin = (): void => {
    setBusy(true);
    setError('');
    void onMockLogin().then((ok) => {
      if (ok) location.replace('/dashboard');
      else {
        setBusy(false);
        setError('Não foi possível entrar agora. Tente de novo.');
      }
    });
  };

  return (
    <main id="conteudo" className="flex min-h-[560px] items-center justify-center px-5 py-16">
      <div className="flex w-full max-w-[420px] flex-col gap-5 rounded-2xl border border-border bg-surface px-8 py-10 text-center">
        <h1 className="text-[28px] font-semibold">Entrar</h1>
        <p className="text-[15px] leading-6 text-muted">Entre com o Discord para configurar o bot nos servidores que você administra.</p>
        {error || failed ? <p role="alert" className="text-sm leading-5 text-text">{error || 'Não foi possível carregar o login agora. Tente de novo.'}</p> : null}
        <a className={primaryButton} href="/auth/discord">Entrar com Discord</a>
        {session?.mock ? (
          <button className={outlineButton} type="button" disabled={busy} onClick={mockLogin}>
            {busy ? 'Entrando…' : 'Entrar como dev'}
          </button>
        ) : null}
        <p className="text-[13px] leading-5 text-subtle">Pedimos só o necessário: identificação e a lista de servidores. Nada é publicado em seu nome.</p>
      </div>
    </main>
  );
}

export { LoginPage };
