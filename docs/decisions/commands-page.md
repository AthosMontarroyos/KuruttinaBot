# Página de comandos: terminal, tópicos em gradiente e roleta no celular

## Contexto

A página `/comandos` era uma lista de cartões claros com filtro por chips, no mesmo estilo calmo do resto do site. Em 4 de novembro de 2026 o responsável pediu um visual próprio para ela: janela de terminal estilo Mac com as três bolinhas, tópicos em retângulos arredondados com cor e gradiente, e um fundo animado de caracteres (estilo Matrix). Em seguida aprovou rolar a lista dentro do terminal (em vez da página inteira) e trocar a barra superior do celular por um botão fixo que abre uma roleta de navegação.

O design system dizia "sem degradê" e "nada de aparência de código ou painel". Esta decisão abre exceções limitadas, para não virarem regra geral.

## Decisão

- **Terminal só como moldura.** A janela (`TerminalWindow`) tem barra com as bolinhas e um título, ambos só decorativos. O conteúdo dentro dela não imita shell: busca, grupos por tópico e cartões de comando. A janela é escura nos dois temas (tokens `terminal-*`).
- **Gradiente só nos chips de tópico.** Cada tópico tem um par de cores (`topic-<id>-from/to`). Selecionado é cheio, com borda forte e um "feito"; os demais usam o mesmo gradiente suave. O resto do site continua sem degradê. Abaixo de 1101px (inclusive com zoom) os chips viram um seletor suspenso com o tópico atual, porque uma fileira de chips quebra desalinhada.
- **Fundo Matrix só nesta página.** Colunas de caracteres em CSS puro (`MatrixRain`), na cor do acento com pouca opacidade, atrás do conteúdo, sem JavaScript por quadro. Parado para quem prefere menos movimento (`prefers-reduced-motion`). Em até 700px há 14 colunas.
- **A página cabe na tela.** O título e os tópicos ficam no topo e só a lista dentro do terminal rola, com busca e contador fixos e o fim da lista em degradê. Em janela mais baixa que 640px a página volta a rolar normalmente. Sem rodapé, como a Home.
- **Roleta no celular.** Até 700px não há barra superior em nenhuma página pública: um botão redondo "K" fica fixo no canto, sempre visível e em destaque (borda forte e pulso), e abre uma roleta com Comandos, Módulos, Termos, Tema, Conta (Entrar ou Sair) e Painel. Com a roleta aberta o botão continua no mesmo lugar e vira "Fechar". O painel de um servidor (`ServerTopBar`) não muda.

## Impacto

- `globals.css`: tokens `terminal-*` e `topic-*` nos três lugares (claro e os dois blocos escuros), e `@theme static` (os tokens de tópico só são lidos em estilo inline e o Tailwind os descartaria).
- A barra do celular (tema, conta, menu) sai de `TopBar`; a navegação do celular é `components/mobile/WheelMenu.tsx`. O rodapé ganha espaço embaixo no celular para o botão não cobrir o texto.
- Telas com `h-dvh` no layout só em `/comandos`; as demais seguem como antes.

## Controles

- Contraste medido (WCAG 2): texto da janela sobre `terminal` de 5,8:1 a 16,3:1; texto escuro sobre cada gradiente de tópico de 7,0:1 a 12,1:1; texto da página sobre a chuva no pior caso, 5,0:1 no claro e 5,7:1 no escuro.
- Teclado: a área rolável é focável e tem nome; a roleta é um diálogo modal com Esc, Tab circulando entre os itens e o botão, e foco devolvido ao botão ao fechar; a seleção de tópico não depende só da cor.
- Movimento: chuva parada e pulso do botão desligados com `prefers-reduced-motion`.
- A chuva e as bolinhas são `aria-hidden`.

## Condição de revisão

Reavaliar se a chuva atrapalhar a leitura ou o desempenho em aparelhos fracos, se outra página pedir terminal, gradiente ou chuva (cada uso novo precisa de aprovação própria), ou se a Home do celular passar a precisar da barra superior.
