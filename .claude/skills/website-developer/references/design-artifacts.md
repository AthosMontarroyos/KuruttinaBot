# Design em artefatos

Fonte visual do site, mantida em artefatos do Claude. Leia antes de criar ou alterar interface em `apps/site`.

## Escopo (MUST)

Vale **somente quando o Claude estiver trabalhando**. Os artefatos ficam na conta do Claude e só ele os lê e publica (ferramenta `Artifact`). Outro agente que mexa no mesmo repositório (Cursor, Codex, Copilot) não tem acesso a eles, não precisa desenhar antes e este fluxo não é exigido dos seus commits.

- Não desfaça nem "corrija" código de outro agente só porque diverge do artefato. Avise o usuário da divergência.
- O fluxo não se estende a outros agentes: não o transforme em exigência de PR nem o copie para outros arquivos de instrução.

## Os artefatos

Cada tela é um arquivo `project/*.dc.html`; `project/canvas.json` lista páginas, ordem e posições. A ordem das páginas segue a da lateral do painel.

- [Kuruttina — Home](https://claude.ai/artifact/EQTpe4ukbPY5KhjtX8ZkmP): Home, Comandos, Módulos (vazia), Termos (vazia), Painel de controle (escolha de servidor) e Mobile Components (a roleta do celular, que no celular substitui a barra superior).
- [Kuruttina — Painel do servidor](https://claude.ai/artifact/KBW335o3MkvZpmzi4g7HLQ): Visão geral, Mensagens, Entrada e saída, Cargos e Components (seletores, seletores avançados, controles de formulário, feedback e diálogos).
- [Design System](https://claude.ai/artifact/Y2HRdEM97Ag26dG7pPZFGy): paleta, contraste e tema escuro.

## Procedimento

1. **Leia a tela antes de mexer** (`list` de arquivos, `read` de `project/canvas.json` para achar a tela e do `.dc.html`), nunca de memória. Para um componente reutilizável, leia a página Components.
2. **Design primeiro.** Mudança de aparência, de fluxo ou tela nova: desenhe ou atualize no artefato, mostre ao usuário e espere a aprovação; só depois altere o código. Correção sem efeito visual dispensa o desenho.
3. **O código segue o artefato** em estrutura, textos e estados. As cores vêm sempre dos tokens de `globals.css`, nunca dos hex do artefato, nos dois temas.
4. **Mantenha os dois alinhados.** Se o código ficou à frente do artefato, atualize o artefato na mesma tarefa, ou avise o usuário.
5. **Não invente trabalho de design.** Não crie nem redesenhe telas por conta própria. Seção que o usuário disse que montará ele mesmo não se mexe, e as páginas Módulos e Termos estão vazias de propósito. "Replicar o código" é reproduzir layout, textos, tamanhos e estados do código, trocando só as cores; redesenhar só quando pedido.
6. **Texto de produto.** O que vale para o site vale para o artefato: nada de observação de desenvolvimento nos textos (veja o MUST de [SKILL.md](../SKILL.md)).

## Mecânica de publicação

- O usuário edita os artefatos pelo navegador. Antes de publicar, leia o `project/canvas.json` ao vivo; publicação sobre uma versão mais nova é recusada. Refaça sobre a versão atual e nunca use `force`.
- Publique só os arquivos alterados. O índice só muda ao acrescentar, remover, mover ou redimensionar uma tela, ou ao mudar páginas. Remover uma tela é tirá-la do `canvas.json` e apagar o arquivo.
- As regras de formato do tipo Design estão no `SKILL.md` do próprio artefato (e em `artifact-type/reference/format.md`).
