const glyphs = Array.from('ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789/!');
const columnCount = 52;

type Column = { text: string; duration: number; delay: number; opacity: number };

/** Colunas fixas (mesma semente sempre): a tela não muda de um carregamento para o outro e não há aleatório em render. */
function buildColumns(): Column[] {
  let seed = 7;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: columnCount }, () => {
    const length = 14 + Math.floor(random() * 16);
    const text = Array.from({ length }, () => glyphs[Math.floor(random() * glyphs.length)] ?? '0').join('\n');
    const duration = 9 + random() * 11;
    return { text, duration, delay: -random() * duration, opacity: 0.55 + random() * 0.45 };
  });
}

const columns = buildColumns();

/**
 * Fundo de caracteres caindo, só em CSS (`.matrix-column` em `globals.css`): sem JavaScript por quadro e parado para quem
 * prefere menos movimento. Fica atrás do conteúdo, não recebe cliques e é invisível para tecnologia assistiva. A cor vem do
 * `--color-accent`, com pouca opacidade, para o texto da página continuar legível por cima.
 *
 *     <MatrixRain />
 */
function MatrixRain() {
  return (
    <div className="matrix-rain pointer-events-none fixed inset-0 -z-10 flex justify-around overflow-hidden" aria-hidden="true">
      {columns.map((column, index) => (
        <span key={index} className="matrix-column" style={{ animationDuration: `${column.duration.toFixed(1)}s`, animationDelay: `${column.delay.toFixed(1)}s`, opacity: column.opacity.toFixed(2) }}>
          {column.text}
        </span>
      ))}
    </div>
  );
}

export { MatrixRain };
