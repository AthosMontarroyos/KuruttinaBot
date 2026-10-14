'use client';

import { useState, type ReactNode } from 'react';

const socials = [
  { label: 'Instagram do criador', notice: 'O Instagram do criador ainda não foi configurado.', icon: '/icons/social/instagram.svg' },
  { label: 'TikTok do criador', notice: 'O TikTok do criador ainda não foi configurado.', icon: '/icons/social/tiktok.svg' },
  { label: 'GitHub do criador', notice: 'O GitHub do criador ainda não foi configurado.', icon: '/icons/social/github.svg' },
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
        <p className="max-w-[75ch] text-base leading-5 text-muted min-[701px]:text-lg min-[701px]:leading-[23px]">
          O Kuruttina entra no seu servidor pelo Discord. Adicione o bot quando quiser. A Dashboard aparece aqui quando o painel existir.
        </p>
        <div className="flex flex-wrap items-center gap-2 min-[701px]:gap-3">
          <button
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border-0 bg-button p-0 text-muted min-[701px]:size-11"
            type="button"
            aria-label="Discord do bot"
            onClick={() => onNotice('O link da comunidade ainda não foi configurado.')}
          >
            <IconImage src="/icons/community/discord.svg" mobileSrc="/icons/community/discord-mobile.svg" />
          </button>
          <Pill onClick={() => onNotice('O convite do bot ainda não foi configurado.')}>Adicionar ao Discord</Pill>
          <Pill secondary onClick={() => onNotice('O painel de controle ainda está em desenvolvimento.')}>Painel de controle</Pill>
        </div>
        <nav className="flex gap-2.5" aria-label="Redes do criador">
          {socials.map((item) => (
            <button
              key={item.label}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface p-0 text-muted"
              type="button"
              aria-label={item.label}
              onClick={() => onNotice(item.notice)}
            >
              <img src={item.icon} alt="" />
            </button>
          ))}
          <button
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface p-0 text-base font-bold text-muted"
            type="button"
            aria-label="X do criador"
            onClick={() => onNotice('O perfil do criador no X ainda não foi configurado.')}
          >
            X
          </button>
        </nav>
      </div>
      <figure className="h-[420px] w-full overflow-hidden rounded-[28px] bg-surface min-[701px]:h-[520px] min-[701px]:rounded-[32px] min-[1101px]:w-[420px]">
        {avatarUrl && !portraitFailed ? (
          <img
            className="size-full object-cover"
            src={avatarUrl}
            alt="Ilustração de uma garota de cabelo escuro e olhos dourados, avatar provisório da Kuruttina."
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

function Pill({ children, onClick, secondary = false }: { children: ReactNode; onClick: () => void; secondary?: boolean }) {
  return (
    <button
      className={`rounded-full border-0 px-3 py-2.5 text-[13px] leading-4 font-semibold whitespace-nowrap min-[701px]:px-[22px] min-[701px]:py-3.5 min-[701px]:text-[15px] min-[701px]:leading-[19px] ${secondary ? 'bg-secondary text-button-text' : 'bg-button text-button-text'}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export { HomePage };
