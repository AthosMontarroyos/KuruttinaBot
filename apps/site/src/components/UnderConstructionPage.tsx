type UnderConstructionProps = {
  title: string;
};

function UnderConstructionPage({ title }: UnderConstructionProps) {
  return (
    <main id="conteudo" className="flex min-h-[420px] flex-col items-start justify-center gap-5 px-5 py-12 min-[701px]:min-h-[560px] min-[701px]:px-[5%]">
      <svg className="size-14 text-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
      </svg>
      <h1 className="text-[40px] leading-[1.2] font-semibold min-[701px]:text-[52px]">{title}</h1>
      <p className="max-w-[60ch] text-base leading-6 text-muted min-[701px]:text-lg">Esta página está em construção. Ela aparece aqui quando estiver pronta.</p>
      <a className="rounded-full bg-button px-[22px] py-3.5 text-[15px] leading-[19px] font-semibold text-button-text" href="/">
        Voltar ao início
      </a>
    </main>
  );
}

export { UnderConstructionPage };
