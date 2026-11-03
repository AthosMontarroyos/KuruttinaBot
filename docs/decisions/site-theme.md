# Tema do site: claro e escuro

Status: aprovado pelo responsável pelo projeto em 3 de novembro de 2026.

O site tem dois temas, claro e escuro, com os mesmos nomes de token. O tema escuro volta (foi removido em 2 de novembro de 2026 para ser decidido depois) com estas decisões:

- **A página não vira outra ao trocar de tema.** Composição, posições, tamanhos e tipografia são idênticos; só os valores dos tokens mudam. Uma capa da Home diferente no escuro (arco, moldura, título menor) foi descartada.
- **Seleção pelo sistema e por botão.** Sem escolha, o tema segue `prefers-color-scheme`. Um botão na barra alterna do sistema, claro e escuro, e a escolha fica em `localStorage`.
- **Disco da Home escuro em ameixa**, não rosa-claro: o rosa-claro tornava ilegíveis os links da barra que cruzam o disco.
- **A arte da Home precisa de versão sem fundo no escuro.** A original tem fundo branco e só funciona com `multiply` sobre claro. O recorte é um arquivo novo no R2 (`dashboard/LaddingPage/CardRetrato-recorte.png`), que o responsável envia.
- **Dois valores do claro foram corrigidos** por falharem em contraste: `--color-control` (`#a3869a` para `#9a7b90`, 3:1 dentro de cartão) e `--color-warning` (`#b45f06` para `#a35405`, 4,5:1 como texto).

Valores, contraste medido e regras estão no [Design System](https://claude.ai/artifact/Y2HRdEM97Ag26dG7pPZFGy). Procedimento na [skill do website](../../.claude/skills/website-developer/SKILL.md) e implementação em `apps/site/src/app/globals.css`, `apps/site/src/lib/theme.ts` e `apps/site/public/theme-init.js`.
