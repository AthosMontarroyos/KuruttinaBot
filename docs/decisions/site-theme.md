# Tema do site: claro e escuro

Status: aprovado pelo responsável pelo projeto em 3 de novembro de 2026.

O site tem dois temas, claro e escuro, com os mesmos nomes de token. O tema escuro volta (foi removido em 2 de novembro de 2026 para ser decidido depois) com estas decisões:

- **A página não vira outra ao trocar de tema.** Composição, posições, tamanhos e tipografia são idênticos; só os valores dos tokens mudam. Uma capa da Home diferente no escuro (arco, moldura, título menor) foi descartada.
- **O tema claro é o foco; o escuro é complementar.** O escuro existe para quem quer descansar a vista. Todo desenho e toda funcionalidade nova começam e são aprovados no claro; o escuro é derivado pelos mesmos tokens, sem composição própria, e um ajuste fino dele nunca bloqueia uma entrega.
- **Seleção pelo sistema e por botão.** Sem escolha, o tema segue `prefers-color-scheme`. Um botão na barra alterna do sistema, claro e escuro, e a escolha fica em `localStorage`.
- **Disco da Home escuro em ameixa**, não rosa-claro: o rosa-claro tornava ilegíveis os links da barra que cruzam o disco.
- **Uma só arte, sem fundo, nos dois temas.** A original (`CardRetrato.jpg`, fundo branco) só funciona com `multiply` sobre claro, e CSS sozinho não separa o branco do fundo do branco da camisa e dos brilhos da personagem. O responsável gerou uma versão recortada com um gerador de imagens (um redesenho: a cabeça e a máscara coincidem, a mão, o livro e as mechas diferem um pouco) e aprovou usá-la nos dois temas. Ela foi alinhada à original num canvas de 1472×2616 e fica no R2 em `dashboard/LaddingPage/RetratoHomeRecorte.webp`; o responsável envia o arquivo. A `CardRetrato.jpg` permanece no R2.
- **Dois valores do claro foram corrigidos** por falharem em contraste: `--color-control` (`#a3869a` para `#9a7b90`, 3:1 dentro de cartão) e `--color-warning` (`#b45f06` para `#a35405`, 4,5:1 como texto).

Valores, contraste medido e regras estão no [Design System](https://claude.ai/artifact/Y2HRdEM97Ag26dG7pPZFGy). Procedimento na [skill do website](../../.claude/skills/website-developer/SKILL.md) e implementação em `apps/site/src/app/globals.css`, `apps/site/src/lib/theme.ts` e `apps/site/public/theme-init.js`.
