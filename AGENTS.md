# Regras globais do KuruttinaBot

## Escopo e precedência

Este arquivo é o roteador de instruções do monorepo para pessoas e agentes de IA. Leia sempre este arquivo e consulte em `docs/agents/` somente os documentos pertinentes aos artefatos e domínios da tarefa atual. Não carregue os demais documentos preventivamente.

A precedência é: pedido explícito da tarefa > este arquivo e decisões arquiteturais registradas > documento modular aplicável > skill especializada > convenção local do módulo. Um pedido não autoriza violar segurança, privacidade ou restrições da plataforma silenciosamente: registre o conflito e peça decisão. Nos documentos, `MUST` é invariante, `SHOULD` é o padrão e `MAY` é opção contextual.

### Regra: mudança proporcional

**Nível:** SHOULD

Faça a menor mudança coerente que resolva o requisito. Não inclua limpeza, migração tecnológica ou abstração sem relação com a tarefa. Correções adjacentes indispensáveis para compilar, testar ou fechar uma vulnerabilidade devem ser explicadas no resultado.

### Regra: evidência antes de exceção

**Nível:** MUST

Toda exceção a uma regra `MUST` ou a uma fronteira arquitetural precisa de justificativa escrita, impacto, controles compensatórios e aprovação humana. Exceções temporárias recebem responsável e condição de remoção.

### Leitura por domínio — MUST

Antes de alterar um artefato, leia integralmente cada documento diretamente aplicável. Quando a tarefa cruzar domínios, leia todos os documentos correspondentes. As regras modulares complementam este roteador e continuam obrigatórias dentro do próprio escopo.

## Índice sob demanda

- [Estado implementado](docs/project/current-state.md): snapshot verificável do que existe hoje, comandos, runtime, deploys, segurança, testes e lacunas conhecidas.
- [Arquitetura e contratos](docs/agents/architecture.md): estrutura do monorepo, dependências, composição, TypeScript, contratos e configuração tipada.
- [PostgreSQL e acesso a dados](docs/agents/database.md): schema, migrations, queries, repositories, RLS, roles, pooling e transações.
- [Discord bot](docs/agents/discord-bot.md): discord.js, credenciais por ambiente, command sync, registry, memória e ciclo de vida.
- [Dashboard Next.js e administração](docs/agents/nextjs.md): App Router, React, Tailwind, OAuth, sessões, CSRF, cache e operações administrativas.
- [Segurança transversal](docs/agents/security.md): validação, autorização, secrets, XSS, SSRF, uploads, rate limit e resposta a erro.
- [Deployment, operação e performance](docs/agents/deployment.md): aplicação Square Cloud, Supabase, recursos, observabilidade e resiliência.
- [Assets](docs/agents/assets.md): armazenamento R2, integração, otimização, proveniência e limpeza.
- [Desenvolvimento, testes e conclusão](docs/agents/testing.md): comandos, testes, Git, documentação, ambientes, divisão entre skills e Definition of Done.

## Uso conjunto

- Uma mudança de banco também consulta segurança e testes quando envolver RLS, autorização, privilégios ou migration.
- OAuth, sessão, autorização ou administração consulta Next.js, segurança e testes.
- Deploy de bot/site consulta deployment e o documento do app afetado.
- Mudança transversal consulta arquitetura e todos os domínios afetados.
- Assets externos consultam assets; sua exposição pelo site consulta também Next.js e deployment quando alterar build ou distribuição.

Não duplique regras entre este arquivo, documentos modulares e skills. Procedimentos especializados adicionam workflow e ferramentas do domínio sem substituir estas regras.
