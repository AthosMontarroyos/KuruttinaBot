'use client';

import { useState, type CSSProperties } from 'react';
import { JokerDeck } from '../components/home/JokerDeck';
import { Necklaces } from '../components/home/Necklaces';

type HomePageProps = {
  coverUrl: string;
  onNotice: (message: string) => void;
};

// Contorno fino: a arte é preta, então precisa de uma borda para não sumir sobre o fundo escuro.
const artStyle: CSSProperties = {
  filter: 'drop-shadow(0 0 1px var(--color-halo)) drop-shadow(0 0 1px var(--color-halo))',
};

const display = "font-display font-light leading-none tracking-[-0.045em] [font-variation-settings:'SOFT'_0,'opsz'_144]";
const statement = "m-0 font-display font-normal tracking-[-0.02em] text-text [font-variation-settings:'SOFT'_0,'opsz'_72]";
const cta = 'inline-flex h-[50px] w-full items-center justify-center rounded-[2px] border px-6 text-base leading-4 font-semibold whitespace-nowrap min-[1101px]:h-[52px]';

function HomePage({ coverUrl, onNotice }: HomePageProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const art = coverUrl && !coverFailed ? (
    <img
      className="block h-full w-auto max-w-none"
      style={artStyle}
      src={coverUrl}
      alt="Ilustração em preto e branco da Kuruttina: uma garota de cabelo longo, camiseta listrada com rede por cima e colar de lua, estendendo as duas mãos para a frente."
      fetchPriority="high"
      onError={() => setCoverFailed(true)}
    />
  ) : null;

  return (
    <main
      id="conteudo"
      className="relative isolate flex min-h-0 flex-1 flex-col items-center overflow-hidden bg-background px-5 pt-6 pb-24 text-text min-[701px]:pt-[132px] min-[1101px]:min-h-[640px] min-[1101px]:px-[5%] min-[1101px]:py-0"
    >
      {/* Decoração atrás da personagem: cordões nos cantos e o baralho de coringas (camada 1; a personagem fica na 2). */}
      <Necklaces />
      <JokerDeck />

      {/* Celular e tablet: nome, personagem e ações em coluna. */}
      <h1 className={`${display} relative z-[1] m-0 text-[clamp(64px,19vw,140px)] min-[1101px]:hidden`}>Kuruttina</h1>
      <div aria-hidden={art ? undefined : true} className="relative z-[2] mt-1 h-[clamp(300px,46dvh,560px)] shrink-0 min-[1101px]:hidden">{art}</div>

      {/* Desktop: a personagem no centro, com o nome dividido em dois lados dela. */}
      <h1
        aria-label="Kuruttina"
        className={`${display} absolute inset-x-0 top-[27.8%] z-[1] m-0 hidden h-0 text-[clamp(80px,min(13.9vw,22.2dvh),260px)] min-[1101px]:block`}
      >
        <span aria-hidden="true" className="absolute right-[calc(50%+26.7dvh)] whitespace-nowrap">Kuru</span>
        <span aria-hidden="true" className="absolute left-[calc(50%+30dvh)] whitespace-nowrap">ttina</span>
      </h1>
      <div className="absolute bottom-[-7%] left-1/2 z-[2] hidden h-[96%] -translate-x-1/2 min-[1101px]:block">{art}</div>

      <div className="relative z-[2] mt-4 flex w-full max-w-[420px] flex-col gap-3 min-[1101px]:absolute min-[1101px]:bottom-16 min-[1101px]:left-[5%] min-[1101px]:mt-0 min-[1101px]:w-[min(330px,28%)] min-[1101px]:max-w-none min-[1101px]:gap-[18px]">
        <div className="flex items-center gap-3.5">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center bg-text font-['Noto_Serif_JP','Hiragino_Mincho_ProN',serif] text-[28px] leading-none font-bold text-background">狂</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <p className={`${statement} text-[25px] leading-[1.12] min-[1101px]:text-[34px]`}>Sua comunidade merece mais do que silêncio.</p>
      </div>

      <div className="relative z-[2] mt-3.5 flex w-full max-w-[420px] flex-col gap-2.5 min-[1101px]:absolute min-[1101px]:right-[5%] min-[1101px]:bottom-16 min-[1101px]:mt-0 min-[1101px]:w-[min(300px,26%)] min-[1101px]:max-w-none min-[1101px]:gap-3.5 min-[1101px]:border-t min-[1101px]:border-border min-[1101px]:pt-[18px]">
        <p className="m-0 mb-1 hidden text-base leading-[1.45] text-muted min-[1101px]:block">Eu sou a Kuruttina. Adicione-me ao seu servidor.</p>
        <button className={`${cta} border-button bg-button text-button-text hover:opacity-90`} type="button" onClick={() => onNotice('O convite do bot estará disponível em breve.')}>
          Adicionar ao Discord
        </button>
        <a className={`${cta} border-text bg-transparent text-text hover:bg-surface`} href="/dashboard">
          Painel de controle
        </a>
      </div>
    </main>
  );
}

export { HomePage };
