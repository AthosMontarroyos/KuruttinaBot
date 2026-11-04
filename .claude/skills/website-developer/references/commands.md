# Página de comandos e roleta do celular

Aprovado em 04/11/2026 ([decisão](../../../../docs/decisions/commands-page.md)). Mockup: páginas "Comandos" e "Menu do celular" do canvas [Kuruttina — Redesign da Home](https://claude.ai/artifact/EQTpe4ukbPY5KhjtX8ZkmP). Leia só ao desenhar ou mexer em `/comandos` ou na navegação do celular. Dados do catálogo e regra de nunca escrever a lista de commands à mão estão em [SKILL.md](../SKILL.md).

## O que é exceção (e só aqui)

O resto do site é liso, sem degradê e sem aparência de código. Nesta página valem, e não se estendem a outras sem nova aprovação:

- **Janela de terminal** (`TerminalWindow`): moldura com três bolinhas e título decorativos (`aria-hidden`), escura nos dois temas. O conteúdo dentro NÃO imita shell: busca, títulos de grupo e cartões. Cores sempre dos tokens `terminal-*`; as bolinhas são `terminal-close`, `terminal-minimize` e `terminal-zoom`.
- **Chips de tópico em gradiente** (`TopicFilter`): par de cores `topic-<id>-from/to` por tópico (`all`, `public`, `utility`, `fun`, `mod`); tópico novo sem visual em `topic-visuals.tsx` usa o de "Todos". Selecionado = gradiente cheio + borda `accent-fg` + check; não selecionado = o mesmo gradiente a 33% sobre `surface` + borda `control`. Esses tokens ficam em `@theme static` porque só são lidos em estilo inline.
- **Fundo Matrix** (`MatrixRain`): só CSS (`.matrix-column` em `globals.css`), cor do `--color-accent` com 30% a 45% de opacidade, atrás de tudo (`fixed -z-10`, `aria-hidden`, sem cliques). Colunas fixas por semente, sem `Math.random` no render. Parado em `prefers-reduced-motion`. Até 700px só 14 colunas.

## Layout

- A página cabe na altura da tela: `layout.tsx` envolve tudo em `h-dvh min-h-[640px]` só em `/comandos` (nas demais rotas o wrapper é `contents`), sem rodapé. Só `.terminal-scroll` rola (`overscroll-behavior: contain`, `tabIndex={0}`, `role="region"`, nome "Lista de comandos"); busca e contador ficam fixos acima, e o título de cada grupo é `sticky`.
- Tópicos: chips lado a lado a partir de 1101px, em linha própria abaixo do título. Abaixo disso (inclusive zoom) é um botão com o tópico atual que abre a lista. Não volte a pôr os chips ao lado do título: com mais tópicos ou zoom eles quebravam desalinhados.
- Medidas do desenho: título 52px (celular), 64px (tablet) e 84px (desktop), em `font-display`; cartões em 1 coluna no celular e 2 a partir de 701px; contador oculto no celular.

## Roleta do celular

- Até 700px nenhuma página pública tem barra superior (`TopBar` renderiza só o `WheelMenu` nessa largura; o painel de servidor continua com `ServerTopBar`). `WheelMenu` é um botão redondo fixo, sempre visível e em destaque (64px, borda `accent-fg`, pulso `animate-save-attention` parado em `motion-reduce`), que abre um disco com seis itens em volta (`lib/wheel.ts`: primeiro no topo, sentido horário): Comandos, Módulos, Termos, Tema, Conta (Entrar ou Sair) e Painel. A lista de links vem de `lib/site-navigation.ts`, a mesma da barra do desktop.
- Aberta, o botão fica no mesmo lugar e vira "Fechar"; o centro do disco mostra o "K" só como marca. Fecha com o botão, o fundo, Esc ou ao escolher um destino (o item Tema não fecha, para ver a troca). É um diálogo modal: foco vai para o primeiro item, Tab circula entre os itens e o botão, Esc devolve o foco ao botão, e a rolagem da página fica travada enquanto aberta.
- O rodapé tem espaço extra embaixo no celular (`pb-24`) e a lista do terminal também, para o botão não cobrir texto.

## Validação

`tests/commands-page.test.ts` cobre os helpers puros, a paridade dos tokens e a chuva parada com menos movimento; `tests/theme.test.ts` confere que todo token claro tem par escuro. Confira no navegador: 1440×900, uma largura intermediária (~1000px, que simula zoom) e 390×844, nos dois temas, com a roleta aberta e fechada.
