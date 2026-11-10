'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

const socials = [
  { label: 'Instagram do criador', notice: 'O Instagram do criador estará disponível em breve.', icon: '/icons/social/instagram.svg' },
  { label: 'TikTok do criador', notice: 'O TikTok do criador estará disponível em breve.', icon: '/icons/social/tiktok.svg' },
  { label: 'GitHub do criador', notice: 'O GitHub do criador estará disponível em breve.', icon: '/icons/social/github.svg' },
  { label: 'X do criador', notice: 'O perfil do criador no X estará disponível em breve.', icon: '/icons/social/x.svg' },
] as const;

type HomePageProps = {
  coverUrl: string;
  onNotice: (message: string) => void;
};

// Meia-tinta do quadro da arte: pontos de texto com máscara diagonal (só o token, troca sozinho no tema escuro).
const halftoneStyle: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, var(--color-text) 1.2px, transparent 1.8px)',
  backgroundSize: '9px 9px',
  opacity: 0.16,
  maskImage: 'linear-gradient(200deg, var(--color-text) 0, transparent 72%)',
  WebkitMaskImage: 'linear-gradient(200deg, var(--color-text) 0, transparent 72%)',
};

// Contorno claro fino: a arte é preta, então no tema escuro ela precisa de borda para não sumir no fundo.
const artStyle: CSSProperties = {
  filter: 'drop-shadow(0 0 1px color-mix(in srgb, var(--color-text) 60%, transparent))',
};

function IconImage({ src, mobileSrc, className }: { src: string; mobileSrc?: string; className?: string }) {
  return (
    <picture>
      {mobileSrc ? <source media="(max-width: 700px)" srcSet={mobileSrc} /> : null}
      <img className={className} src={src} alt="" />
    </picture>
  );
}

function HomePage({ coverUrl, onNotice }: HomePageProps) {
  const [coverFailed, setCoverFailed] = useState(false);

  return (
    <main
      id="conteudo"
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-5 pt-10 text-text min-[701px]:min-h-[640px] min-[701px]:px-[5%] min-[701px]:pt-[120px] min-[1101px]:pt-[150px]"
    >
      <div
        aria-hidden="true"
        className="relative h-[316px] w-full min-[701px]:absolute min-[701px]:top-[120px] min-[701px]:right-[5%] min-[701px]:h-[clamp(440px,44.4vw,640px)] min-[701px]:w-[clamp(340px,34.7vw,500px)] min-[1101px]:top-[150px]"
      >
        <div className="absolute inset-0 overflow-hidden border-2 border-text bg-surface">
          <div className="absolute inset-0" style={halftoneStyle} />
        </div>
        {coverUrl && !coverFailed ? (
          <img
            className="absolute top-[-10.8%] left-1/2 h-[110.8%] w-auto max-w-none -translate-x-1/2 min-[701px]:top-[-9.4%] min-[701px]:right-[-8%] min-[701px]:left-auto min-[701px]:h-[109.4%] min-[701px]:translate-x-0"
            style={artStyle}
            src={coverUrl}
            alt="Ilustração em preto e branco da Kuruttina: uma garota de cabelo longo, camiseta listrada com rede por cima e colar de lua, estendendo as duas mãos para a frente."
            fetchPriority="high"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute top-[-14px] left-[-14px] z-[3] flex size-14 items-center justify-center bg-text font-['Noto_Serif_JP',serif] text-[36px] leading-none font-bold text-background min-[701px]:top-[-5.3%] min-[701px]:left-[-6.8%] min-[701px]:size-16 min-[701px]:text-[42px] min-[1101px]:size-[84px] min-[1101px]:text-[54px]"
        >
          狂
        </div>
      </div>

      <div className="relative z-[2] order-2 flex flex-col items-start gap-4 min-[701px]:order-none min-[701px]:max-w-[min(600px,46%)] min-[701px]:gap-6">
        <p className="text-base leading-[1.45] text-muted min-[701px]:max-w-[480px] min-[701px]:text-2xl min-[701px]:leading-[1.4]">
          Oi, eu sou a Kuruttina. Vim para deixar a sua comunidade mais viva, e ficar por perto.
        </p>
        <div className="flex w-full flex-col gap-2.5 min-[701px]:w-auto min-[701px]:flex-row min-[701px]:flex-wrap min-[701px]:items-center min-[701px]:gap-3">
          <Pill onClick={() => onNotice('O convite do bot estará disponível em breve.')}>Adicionar ao Discord</Pill>
          <div className="flex gap-2.5 min-[701px]:contents">
            <a
              className="inline-flex h-[52px] flex-1 items-center justify-center rounded-[6px] border-2 border-text px-[30px] text-base leading-4 font-semibold whitespace-nowrap text-text hover:bg-surface min-[701px]:h-14 min-[701px]:flex-none min-[701px]:text-[17px]"
              href="/dashboard"
            >
              Painel de controle
            </a>
            <button
              className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-[6px] border border-border bg-surface p-0 text-muted hover:border-accent-fg hover:text-accent-fg min-[701px]:size-14"
              type="button"
              aria-label="Servidor de suporte"
              onClick={() => onNotice('O servidor de suporte estará disponível em breve.')}
            >
              <IconImage src="/icons/community/discord.svg" mobileSrc="/icons/community/discord-mobile.svg" />
            </button>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="my-auto hidden h-16 w-[calc(100%-54%)] bg-[repeating-linear-gradient(180deg,var(--color-text)_0,var(--color-text)_8px,transparent_8px,transparent_16px)] min-[701px]:block min-[1101px]:w-[calc(100%-520px)]"
      />

      <h1 className="home-title relative z-[3] order-1 mt-5 font-display text-[66px] leading-[0.95] font-medium tracking-[-0.04em] whitespace-nowrap min-[701px]:order-none min-[701px]:mt-0 min-[701px]:-ml-1.5 min-[701px]:text-[clamp(96px,11vw,160px)]">
        Kuruttina
        <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-[0.07em] inline-block size-[0.26em] fill-current">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </h1>

      <nav
        className="relative z-[3] order-3 mt-auto flex items-center justify-center gap-2.5 py-4 min-[701px]:order-none min-[701px]:mt-0 min-[701px]:justify-start min-[701px]:py-4"
        aria-label="Redes do criador"
      >
        {socials.map((item) => (
          <button
            key={item.label}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-transparent p-0 text-muted hover:border-accent-fg hover:text-accent-fg"
            type="button"
            aria-label={item.label}
            onClick={() => onNotice(item.notice)}
          >
            <img src={item.icon} alt="" />
          </button>
        ))}
      </nav>

      <div
        aria-hidden="true"
        className="relative order-4 mr-[84px] mb-[22px] h-[18px] shrink-0 bg-text bg-[length:30px_18px] bg-repeat-x bg-[radial-gradient(circle_at_center,var(--color-background)_0,var(--color-background)_2.9px,transparent_3.5px)] min-[701px]:order-none min-[701px]:mr-0 min-[701px]:mb-[26px] min-[701px]:h-7 min-[701px]:bg-[length:44px_28px] min-[701px]:bg-[radial-gradient(circle_at_center,var(--color-background)_0,var(--color-background)_4.5px,transparent_5.1px)]"
      >
        <span className="absolute -top-[7px] right-10 h-8 w-10 box-border rounded-[4px] border-[3px] border-text bg-background min-[701px]:-top-2 min-[701px]:right-[120px] min-[701px]:h-11 min-[701px]:w-14">
          <span className="absolute top-1/2 left-1/2 h-[3px] w-[55%] -translate-x-[27%] -translate-y-1/2 bg-text" />
        </span>
      </div>
    </main>
  );
}

function Pill({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="h-[52px] w-full rounded-[6px] border-2 border-button bg-button px-[30px] text-base leading-4 font-semibold whitespace-nowrap text-button-text hover:border-secondary hover:bg-secondary min-[701px]:h-14 min-[701px]:w-auto min-[701px]:text-[17px]"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export { HomePage };
