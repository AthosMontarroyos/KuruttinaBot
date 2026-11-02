/** Rodapé do site. Fica no fim da tela quando a página é curta (`#root` é uma coluna que ocupa a altura toda) e no fim do conteúdo quando é longa. */
function Footer() {
  return (
    <footer className="mt-auto border-t border-border px-5 pt-5 pb-7 text-[13px] leading-4 font-medium text-subtle min-[701px]:border-0 min-[701px]:px-[5%] min-[701px]:py-6 min-[701px]:text-sm min-[1101px]:text-[clamp(14px,0.9vw,17px)]">
      Kuruttina
    </footer>
  );
}

export { Footer };
