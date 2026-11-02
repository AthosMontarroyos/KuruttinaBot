'use client';

import { useState, type ReactNode } from 'react';

const socials = [
  { label: 'Instagram do criador', notice: 'O Instagram do criador estará disponível em breve.', icon: '/icons/social/instagram.svg' },
  { label: 'TikTok do criador', notice: 'O TikTok do criador estará disponível em breve.', icon: '/icons/social/tiktok.svg' },
  { label: 'GitHub do criador', notice: 'O GitHub do criador estará disponível em breve.', icon: '/icons/social/github.svg' },
  { label: 'X do criador', notice: 'O perfil do criador no X estará disponível em breve.', icon: '/icons/social/x.svg' },
] as const;

type HomePageProps = {
  avatarUrl: string;
  onNotice: (message: string) => void;
};

function IconImage({ src, mobileSrc }: { src: string; mobileSrc?: string }) {
  return (
    <picture>
      {mobileSrc ? <source media="(max-width: 700px)" srcSet={mobileSrc} /> : null}
      <img src={src} alt="" />
    </picture>
  );
}

function HomePage({ avatarUrl, onNotice }: HomePageProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);

  return (
    <main id="conteudo" className="flex min-h-0 flex-col items-stretch gap-7 px-5 pt-3 pb-8 min-[701px]:grid min-[701px]:min-h-[656px] min-[701px]:grid-cols-[minmax(0,1fr)_minmax(280px,38%)] min-[701px]:items-center min-[701px]:gap-8 min-[701px]:px-[5%] min-[701px]:pt-12 min-[701px]:pb-[88px] min-[1101px]:grid-cols-[minmax(0,1fr)_420px] min-[1101px]:gap-x-[72px]">
      <div className="flex flex-col items-start gap-4 min-[701px]:gap-5">
        <h1 className="text-[40px] leading-[50px] font-semibold min-[701px]:text-[52px] min-[701px]:leading-[1.265625] min-[1101px]:text-[64px]">Kuruttina</h1>
        <p className="max-w-[60ch] text-base leading-6 text-muted min-[701px]:text-lg min-[701px]:leading-7">
          O Kuruttina entra no seu servidor pelo Discord. Adicione o bot quando quiser e acompanhe seus servidores pelo painel.
        </p>
        <div className="flex flex-wrap items-center gap-2 min-[701px]:gap-3">
          <button
            className="action-icon inline-flex size-11 shrink-0 items-center justify-center rounded-full border-0 bg-button p-0 text-muted hover:bg-secondary"
            type="button"
            aria-label="Servidor de suporte"
            onClick={() => onNotice('O servidor de suporte estará disponível em breve.')}
          >
            <IconImage src="/icons/community/discord.svg" mobileSrc="/icons/community/discord-mobile.svg" />
          </button>
          <Pill onClick={() => onNotice('O convite do bot estará disponível em breve.')}>Adicionar ao Discord</Pill>
          <a
            className="inline-flex min-h-11 items-center rounded-full border-2 border-text bg-transparent px-4 py-2.5 text-[13px] leading-4 font-semibold whitespace-nowrap text-text hover:bg-surface min-[701px]:px-[22px] min-[701px]:text-[15px] min-[701px]:leading-[19px]"
            href="/dashboard"
          >
            Painel de controle
          </a>
        </div>
        <nav className="flex gap-2.5" aria-label="Redes do criador">
          {socials.map((item) => (
            <button
              key={item.label}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-control bg-surface p-0 text-muted hover:border-text min-[701px]:size-9"
              type="button"
              aria-label={item.label}
              onClick={() => onNotice(item.notice)}
            >
              <img src={item.icon} alt="" />
            </button>
          ))}
        </nav>
      </div>
      <figure className="h-[420px] w-full overflow-hidden rounded-[28px] bg-surface min-[701px]:h-[520px] min-[701px]:rounded-[32px] min-[1101px]:w-[420px]">
        {avatarUrl && !portraitFailed ? (
          <img
            className="size-full object-cover"
            src={avatarUrl}
            alt="Foto de perfil da Kuruttina."
            width={420}
            height={520}
            fetchPriority="high"
            onError={() => setPortraitFailed(true)}
          />
        ) : (
          <figcaption className="p-6 text-muted">Imagem indisponível no momento.</figcaption>
        )}
      </figure>
    </main>
  );
}

function Pill({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="min-h-11 rounded-full border-2 border-button bg-button px-4 py-2.5 text-[13px] leading-4 font-semibold whitespace-nowrap text-button-text hover:bg-secondary hover:border-secondary min-[701px]:px-[22px] min-[701px]:text-[15px] min-[701px]:leading-[19px]"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export { HomePage };
