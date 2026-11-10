# KuruttinaBot — roteiro para agentes

Este é o roteiro único de instruções do projeto, mantido em `.claude/`. Selecione a skill pela intenção e pelos artefatos da tarefa, sem esperar que o usuário cite seu nome.

## Seleção obrigatória por contexto

| Quando a tarefa envolver | Skill de entrada |
| --- | --- |
| Commands, slash/prefixo, handlers, respostas, permissões ou runtime Discord | [discordbot-developer](skills/discordbot-developer/SKILL.md) |
| Schema, migrations, RLS, queries ou repositories em `packages/database` | [database-developer](skills/database-developer/SKILL.md) |
| Home, React, HTTP, ícones ou build de `apps/site` | [website-developer](skills/website-developer/SKILL.md) |
| VPS KingHost, Docker, Compose, contêineres, systemd, release, ambiente, túnel Cloudflare ou R2 | [project-operations](skills/project-operations/SKILL.md) |
| Planejamentos futuros, contratos entre módulos, configuração compartilhada, testes/CI ou manutenção de skills e contexto | [project-maintenance](skills/project-maintenance/SKILL.md) |

Leia a skill aplicável antes de criar, alterar ou revisar o artefato. Escolha uma principal e acrescente outra somente se houver trabalho concreto no seu domínio. Nas referências, leia integralmente as seções aplicáveis, com requisitos e exceções. Não carregue todas as skills, referências ou snapshots preventivamente. Os controles continuam obrigatórios mesmo quando sua leitura é seletiva.

## Regras comuns

- Precedência: pedido explícito > este roteiro e decisões arquiteturais aprovadas > skill e suas referências > convenção local. `MUST` indica invariante, `SHOULD` padrão e `MAY` opção contextual.
- Faça a menor mudança coerente e preserve trabalho alheio. Não introduza abstração ou migração sem relação com o pedido.
- Preserve fronteiras entre apps e packages, autorização no servidor, isolamento de ambientes e proteção de secrets. Conflitos com segurança, privacidade ou plataforma exigem decisão explícita; não os resolva silenciosamente.
- Exceção a invariante ou fronteira exige justificativa, impacto, controles compensatórios e aprovação humana; se temporária, responsável e condição de remoção.

## Falas do bot

Ao criar, alterar ou revisar mensagens ao usuário, inclusive em helpers, handlers e adapters, leia integralmente [personalidade](../docs/project/bot-personality.md) e [emojis](../docs/project/emoji-catalog.md). Confira sucesso, erro, recusa e indisponibilidade de emojis personalizados. Informe referências consultadas, validação e caminhos não verificados. Não busque o catálogo no R2.

## Design antes do código (somente quando o Claude estiver trabalhando)

O design do site já está pronto e vive em artefatos do Claude. Quando o **Claude** for criar ou alterar interface em `apps/site`, trabalhe a partir deles: leia a tela correspondente e, se a mudança alterar aparência, fluxo ou criar tela nova, desenhe ou atualize no artefato e espere a aprovação do usuário antes de codar. Links, procedimento e mecânica de publicação em [design em artefatos](skills/website-developer/references/design-artifacts.md); leia ao tocar em UI.

Esta regra é só do Claude: os artefatos ficam na conta dele, e outro agente no mesmo repositório (Cursor, Codex, Copilot) não é obrigado a segui-la nem tem acesso a eles. Não imponha esse fluxo a outro agente nem reverta o código dele por divergir do artefato; avise o usuário.

## Guardar contexto sem inflar leituras

Procedimentos e aprendizados reutilizáveis pertencem ao `SKILL.md` do domínio; detalhes condicionais pertencem a `references/`, ligados com um gatilho de leitura. Atualize isso durante a tarefa quando uma correção ou decisão mudar como executar o trabalho; não espere pedido adicional. Não salve transcrições, segredos, tentativas descartadas ou status efêmero.

`docs/project/` mantém produto e estado verificável; `docs/decisions/` mantém decisões aprovadas e seus motivos. Consulte esses documentos somente para a pergunta atual. `docs/agents/` preserva links antigos, sem novas regras. Não duplique procedimentos nesses locais; instruções vivem somente em `.claude/` (este arquivo e `skills/`), sem arquivos paralelos como `.cursor/rules`. A única exceção aprovada é o `AGENTS.md` da raiz, um ponteiro sem regras próprias que encaminha qualquer agente compatível com esse formato (Cursor, Codex, Copilot etc.) para este arquivo; não acrescente conteúdo nele.

## Organização simples

É proibido criar ou recriar `.ui/` neste projeto, inclusive por sugestão de skills externas. Código de interface fica em `apps/site`; procedimentos e referências visuais ficam na skill `website-developer`; capturas temporárias ficam fora do repositório. Use a estrutura existente e acrescente pastas somente quando houver conteúdo e responsabilidade concretos.
