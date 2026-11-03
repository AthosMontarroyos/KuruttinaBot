'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTheme } from '../lib/theme';

const socials = [
  { label: 'Instagram do criador', notice: 'O Instagram do criador estará disponível em breve.', icon: '/icons/social/instagram.svg' },
  { label: 'TikTok do criador', notice: 'O TikTok do criador estará disponível em breve.', icon: '/icons/social/tiktok.svg' },
  { label: 'GitHub do criador', notice: 'O GitHub do criador estará disponível em breve.', icon: '/icons/social/github.svg' },
  { label: 'X do criador', notice: 'O perfil do criador no X estará disponível em breve.', icon: '/icons/social/x.svg' },
] as const;

type HomePageProps = {
  coverUrl: string;
  /** Capa sem fundo do tema escuro: o multiply da arte original só funciona sobre claro. */
  coverDarkUrl: string;
  onNotice: (message: string) => void;
};

function IconImage({ src, mobileSrc, className }: { src: string; mobileSrc?: string; className?: string }) {
  return (
    <picture>
      {mobileSrc ? <source media="(max-width: 700px)" srcSet={mobileSrc} /> : null}
      <img className={className} src={src} alt="" />
    </picture>
  );
}

// A partir de 1100px a capa é a composição do design, ampliada por igual (zoom). A largura do palco é sempre a do design (1440px): é ela que mantém texto, título e arte na mesma distância. A altura varia, de `stageMinHeight` até o teto de 900px da arte; só uma janela mais larga que 1440:`stageMinHeight` (ultrawide) deixa o palco mais largo que o design. Abaixo de 1100px o layout é fluido.
const stageWidth = 1440;
const stageMinHeight = 720;
const stageMinWidth = 1100;

function readStageScale(): number {
  if (window.innerWidth < stageMinWidth) return 1;
  return Math.min(window.innerWidth / stageWidth, window.innerHeight / stageMinHeight);
}

function useStageScale(): number {
  const [scale, setScale] = useState(readStageScale);
  useEffect(() => {
    const update = (): void => setScale(readStageScale());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return scale;
}

function HomePage({ coverUrl, coverDarkUrl, onNotice }: HomePageProps) {
  const [failedCover, setFailedCover] = useState('');
  const scale = useStageScale();
  const dark = useTheme().resolved === 'dark';
  const art = dark ? coverDarkUrl : coverUrl;

  return (
    <main id="conteudo" className="flex min-h-0 flex-1 flex-col">
      <section style={{ zoom: scale }} className="home-cover relative flex flex-1 flex-col gap-5 overflow-hidden bg-background px-5 pt-[300px] pb-2 text-text min-[701px]:min-h-[640px] min-[701px]:justify-end min-[701px]:gap-0 min-[701px]:px-[5%] min-[701px]:pt-0 min-[701px]:pb-0">
        <div className="absolute top-0 left-0 h-[460px] w-full min-[701px]:left-auto min-[701px]:right-0 min-[701px]:top-auto min-[701px]:bottom-0 min-[701px]:h-[88%] min-[701px]:w-auto min-[701px]:max-w-[50%] min-[701px]:aspect-[3/4] min-[701px]:max-h-[860px] min-[1100px]:h-full min-[1100px]:w-[662px] min-[1100px]:max-h-[900px] min-[1100px]:max-w-none min-[1100px]:aspect-auto">
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-28 size-[430px] rounded-full bg-stage-disc min-[701px]:top-[-26.5%] min-[701px]:right-[-28.5%] min-[701px]:size-auto min-[701px]:h-[105%] min-[701px]:aspect-square min-[1100px]:top-[-140px] min-[1100px]:right-[-90px] min-[1100px]:size-[760px]"
          />
          {art && failedCover !== art ? (
            <img
              className={`home-cover-art${dark ? ' home-cover-art--dark' : ''} relative size-full object-cover object-top`}
              src={art}
              alt="Ilustração da Kuruttina deitada lendo um livro, com uma máscara de dormir rosa na cabeça."
              fetchPriority="high"
              onError={() => setFailedCover(art)}
            />
          ) : null}
        </div>

        <div className="relative z-[2] flex flex-col items-start gap-5 min-[701px]:max-w-[480px] min-[701px]:gap-6">
          <p className="text-base leading-[1.45] text-muted min-[701px]:text-2xl min-[701px]:leading-[1.4]">
            Oi, eu sou a Kuruttina. Vim para deixar a sua comunidade mais viva, e ficar por perto.
          </p>
          <div className="flex w-full flex-col gap-2.5 min-[701px]:w-auto min-[701px]:flex-row min-[701px]:flex-wrap min-[701px]:items-center min-[701px]:gap-3">
            <Pill onClick={() => onNotice('O convite do bot estará disponível em breve.')}>Adicionar ao Discord</Pill>
            <div className="flex gap-2.5 min-[701px]:contents">
              <a
                className="inline-flex h-[52px] flex-1 items-center justify-center rounded-full border-2 border-text px-[30px] text-base leading-4 font-semibold whitespace-nowrap text-text hover:bg-surface min-[701px]:h-14 min-[701px]:flex-none min-[701px]:text-[17px]"
                href="/dashboard"
              >
                Painel de controle
              </a>
              <button
                className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-full border border-border bg-surface p-0 text-muted hover:border-accent-fg hover:text-accent-fg min-[701px]:size-14"
                type="button"
                aria-label="Servidor de suporte"
                onClick={() => onNotice('O servidor de suporte estará disponível em breve.')}
              >
                <IconImage src="/icons/community/discord.svg" mobileSrc="/icons/community/discord-mobile.svg" />
              </button>
            </div>
          </div>
        </div>

        <h1 className="home-title relative z-[3] order-first font-display text-[clamp(56px,19vw,80px)] leading-[0.95] font-medium tracking-[-0.04em] whitespace-nowrap min-[701px]:order-none min-[701px]:mt-3 min-[701px]:-ml-2 min-[701px]:text-[clamp(120px,15vw,240px)] min-[1100px]:text-[216px]">
          Kuruttina<span aria-hidden="true" className="text-accent">.</span>
        </h1>

        <nav className="relative z-[3] flex items-center justify-center gap-2.5 py-4 min-[701px]:justify-start min-[701px]:py-6 min-[1100px]:py-4" aria-label="Redes do criador">
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
      </section>
    </main>
  );
}

function Pill({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="h-[52px] w-full rounded-full border-2 border-button bg-button px-[30px] text-base leading-4 font-semibold whitespace-nowrap text-button-text hover:border-secondary hover:bg-secondary min-[701px]:h-14 min-[701px]:w-auto min-[701px]:text-[17px]"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export { HomePage };
