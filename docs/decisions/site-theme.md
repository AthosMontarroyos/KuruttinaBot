# Tema do site: claro e escuro

Status: aprovado pelo responsável pelo projeto em 3 de novembro de 2026.

O site tem dois temas, claro e escuro, com os mesmos nomes de token. O tema escuro volta (foi removido em 2 de novembro de 2026 para ser decidido depois) com estas decisões:

- **A página não vira outra ao trocar de tema.** Composição, posições, tamanhos e tipografia são idênticos; só os valores dos tokens mudam. Uma capa da Home diferente no escuro (arco, moldura, título menor) foi descartada.
- **O tema claro é o foco; o escuro é complementar.** O escuro existe para quem quer descansar a vista. Todo desenho e toda funcionalidade nova começam e são aprovados no claro; o escuro é derivado pelos mesmos tokens, sem composição própria, e um ajuste fino dele nunca bloqueia uma entrega.
- **Seleção pelo sistema e por botão.** Sem escolha, o tema segue `prefers-color-scheme`. Um botão na barra alterna do sistema, claro e escuro, e a escolha fica em `localStorage`.
- **Disco da Home escuro em ameixa**, não rosa-claro: o rosa-claro tornava ilegíveis os links da barra que cruzam o disco. *Superado em novembro de 2026: a capa editorial não tem disco.*
- **Uma só arte, sem fundo, nos dois temas.** A original (`CardRetrato.jpg`, fundo branco) só funciona com `multiply` sobre claro, e CSS sozinho não separa o branco do fundo do branco da camisa e dos brilhos da personagem. O responsável gerou uma versão recortada com um gerador de imagens (um redesenho: a cabeça e a máscara coincidem, a mão, o livro e as mechas diferem um pouco) e aprovou usá-la nos dois temas. Ela foi alinhada à original num canvas de 1472×2616 e fica no R2 em `dashboard/LaddingPage/RetratoKuruttina.webp`; o responsável envia o arquivo. A `CardRetrato.jpg` permanece no R2. *Superado em novembro de 2026: a arte atual é `KuruttinaCard.webp`, preto e branco, 1024×1536, sem fundo.*
- **Dois valores do claro foram corrigidos** por falharem em contraste: `--color-control` (`#a3869a` para `#9a7b90`, 3:1 dentro de cartão) e `--color-warning` (`#b45f06` para `#a35405`, 4,5:1 como texto).

Valores, contraste medido e regras estão no [Design System](https://claude.ai/artifact/Y2HRdEM97Ag26dG7pPZFGy). Procedimento na [skill do website](../../.claude/skills/website-developer/SKILL.md) e implementação em `apps/site/src/app/globals.css`, `apps/site/src/lib/theme.ts` e `apps/site/public/theme-init.js`.

## Paleta monocromática

Status: proposta em 6 de novembro de 2026, a confirmar pelo responsável pelo projeto.

A paleta rosa foi substituída por cinzas neutros (matiz e saturação zero) em `globals.css`, nos mesmos nomes de token. Botão e destaque têm a polaridade do tema: quase preto no claro (`#171717`), quase branco no escuro (`#fafafa`; depois `#ffffff`, veja a última seção). Os gradientes dos tópicos de Comandos são cinzas escuros no claro e claros no escuro, porque o texto do chip selecionado usa `button-text`. Os semáforos do terminal são três cinzas. Única exceção de cor: `danger`, `success` e `warning`, para o usuário distinguir erro, sucesso e aviso sem depender só de forma. A ilustração da capa (R2) era colorida e hoje é em preto e branco; a prévia de mensagens do Discord mantém as cores do Discord.

## Escuro executivo e capa editorial (novembro de 2026)

Status: aprovado pelo responsável pelo projeto.

- **Escuro em preto e branco puros.** Fundo `#000000`, texto e botão `#ffffff`, superfície `#0f0f0f`, borda `#262626`; a hierarquia vem dos cinzas intermediários (`muted` `#a6a6a6`, `subtle` `#8a8a8a`, `control` `#6b6b6b`). Foi pedido assim pelo responsável, em lugar de um escuro suavizado (`#1e1e1e`/`#d6d6d6`) que chegou a ser desenhado. Risco conhecido: o contraste máximo (21:1) pode cansar a vista; se isso voltar, o ajuste mais barato é `text` em `#e5e5e5` mantendo o fundo preto.
- **Capa editorial** substitui a mangá/zine e a tentativa com raios: veja `cover-design.md` na skill do site. Token novo `--color-halo` (contorno da arte no escuro).
