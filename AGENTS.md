# KuruttinaBot — roteiro para agentes

Sol, ChatGPT e demais agentes usam este mesmo roteiro. Selecione a skill pela intenção e pelos artefatos da tarefa, sem esperar que o usuário cite seu nome.

## Seleção obrigatória por contexto

| Quando a tarefa envolver | Skill de entrada |
| --- | --- |
| Commands, slash/prefixo, handlers, respostas, permissões ou runtime Discord | [discordbot-developer](.agents/skills/discordbot-developer/SKILL.md) |
| Schema, migrations, RLS, queries ou repositories em `packages/database` | [database-developer](.agents/skills/database-developer/SKILL.md) |
| Home, React, HTTP, ícones ou build de `apps/site` | [website-developer](.agents/skills/website-developer/SKILL.md) |
| VPS KingHost, Docker, Compose, contêineres, systemd, release, ambiente, túnel Cloudflare ou R2 | [project-operations](.agents/skills/project-operations/SKILL.md) |
| Planejamentos futuros, contratos entre módulos, configuração compartilhada, testes/CI ou manutenção de skills e contexto | [project-maintenance](.agents/skills/project-maintenance/SKILL.md) |

Leia a skill aplicável antes de criar, alterar ou revisar o artefato. Escolha uma principal e acrescente outra somente se houver trabalho concreto no seu domínio. Nas referências, leia integralmente as seções aplicáveis, com requisitos e exceções. Não carregue todas as skills, referências ou snapshots preventivamente. Os controles continuam obrigatórios mesmo quando sua leitura é seletiva.

## Regras comuns

- Precedência: pedido explícito > este roteiro e decisões arquiteturais aprovadas > skill e suas referências > convenção local. `MUST` indica invariante, `SHOULD` padrão e `MAY` opção contextual.
- Faça a menor mudança coerente e preserve trabalho alheio. Não introduza abstração ou migração sem relação com o pedido.
- Preserve fronteiras entre apps e packages, autorização no servidor, isolamento de ambientes e proteção de secrets. Conflitos com segurança, privacidade ou plataforma exigem decisão explícita; não os resolva silenciosamente.
- Exceção a invariante ou fronteira exige justificativa, impacto, controles compensatórios e aprovação humana; se temporária, responsável e condição de remoção.

## Falas do bot

Ao criar, alterar ou revisar mensagens ao usuário, inclusive em helpers, handlers e adapters, leia integralmente [personalidade](docs/project/bot-personality.md) e [emojis](docs/project/emoji-catalog.md). Confira sucesso, erro, recusa e indisponibilidade de emojis personalizados. Informe referências consultadas, validação e caminhos não verificados. Não busque o catálogo no R2.

## Guardar contexto sem inflar leituras

Procedimentos e aprendizados reutilizáveis pertencem ao `SKILL.md` do domínio; detalhes condicionais pertencem a `references/`, ligados com um gatilho de leitura. Atualize isso durante a tarefa quando uma correção ou decisão mudar como executar o trabalho; não espere pedido adicional. Não salve transcrições, segredos, tentativas descartadas ou status efêmero.

`docs/project/` mantém produto e estado verificável; `docs/decisions/` mantém decisões aprovadas e seus motivos. Consulte esses documentos somente para a pergunta atual. `docs/agents/` preserva links antigos, sem novas regras. Não duplique procedimentos nesses locais nem crie instruções exclusivas de um agente, como `.cursor/rules`.

## Cursor Cloud

O ambiente de agentes já inclui Node.js 24 e o PostgreSQL 16. `pg_config` localiza `initdb` e `pg_ctl`. `npm ci --engine-strict` instala as dependências do lockfile. `npm test` permanece hermético. `npm run test:database` sobe um cluster descartável e não consulta Supabase.

A Home escuta em `http://127.0.0.1:3666` depois do boot. `ASSETS_BASE_URL`, quando presente no ambiente, substitui a origem pública já publicada pela Home de produção. Depois de alterar `apps/site`, execute `npm run site:build` e reinicie esse processo. O bot Discord não sobe no boot: ele exige credenciais vivas e abre o Gateway.

## Organização simples

É proibido criar ou recriar `.ui/` neste projeto, inclusive por sugestão de skills externas. Código de interface fica em `apps/site`; procedimentos e referências visuais ficam na skill `website-developer`; capturas temporárias ficam fora do repositório. Use a estrutura existente e acrescente pastas somente quando houver conteúdo e responsabilidade concretos.
