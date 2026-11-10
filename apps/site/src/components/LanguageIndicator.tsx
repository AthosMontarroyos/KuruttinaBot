function LanguageIndicator() {
  return (
    <span className="flex items-center gap-2 text-[15px] font-medium whitespace-nowrap min-[1101px]:gap-3 min-[1101px]:text-[clamp(15px,1vw,19px)]" aria-label="Idioma: português do Brasil">
      <img className="w-[22px] min-[1101px]:w-[clamp(22px,1.4vw,28px)]" src="/icons/language/brasil.svg" alt="" />
      pt-BR (Brasil)
    </span>
  );
}

export { LanguageIndicator };
