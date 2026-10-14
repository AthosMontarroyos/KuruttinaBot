---
name: project-maintenance
description: Manter contratos entre módulos, configuração compartilhada, testes/CI e o contexto de agentes do KuruttinaBot. Usar ao reorganizar documentação ou skills e ao registrar procedimentos reutilizáveis; não carregar para mudanças isoladas de UI ou comandos.
---

# Manutenção e contexto do projeto

## Contratos, configuração e testes

- Para dependências, composição ou packages, leia as seções correspondentes de [arquitetura](references/architecture.md). Para configuração/tipos, leia TypeScript, contratos e configuração. Não crie módulos opcionais por antecipação.
- Para novo boundary, autorização, URL, upload ou secrets, leia as seções pertinentes de [segurança](references/security.md). Escolher uma seção não dispensa controles aplicáveis às outras fronteiras realmente afetadas.
- Para testes, CI e conclusão de alteração de código, leia [validação](references/validation.md) e consulte os comandos necessários em [desenvolvimento](../../../docs/project/development.md). Escolha testes pelo comportamento e risco, não por contagem de arquivos.

## Manter skills e referências

1. Identifique a intenção que deve acionar a skill. Escreva esse gatilho em `description`, com os artefatos relevantes; não dependa de o usuário invocar `$nome`.
2. Mantenha em `SKILL.md` o procedimento executável: como localizar a implementação, decidir a mudança e validar o resultado. Detalhe usado apenas num modo vai em `references/`, com link e condição de leitura.
3. Ao descobrir uma restrição duradoura, corrigir um procedimento ou receber preferência reutilizável, atualize a skill responsável durante a tarefa. Guarde apenas contexto necessário para a próxima execução. Decisão arquitetural aprovada vai para `docs/decisions/`; comportamento implementado vai para `docs/project/`. Não transforme hipótese em decisão.
4. Antes de mover conteúdo, confira consumidores e links. Preserve requisitos, exceções e mudanças locais. Não duplique o mesmo procedimento em docs e skills. `docs/agents/` é compatibilidade para links antigos, não fonte nova.
5. Verifique frontmatter, links relativos e referências acessíveis; mantenha invocação implícita habilitada. Para alteração só documental, não rode build do produto sem motivo. Revise exemplos de seleção: uma fala usa bot e referências de voz; um SVG usa website e assets; migration usa banco; deploy usa operação. Nenhum desses casos deve carregar tudo.
6. No resultado, informe o que mudou e os limites da validação. Não afirme que seleção automática foi testada em outra sessão se houve apenas revisão estática.

O estado completo do projeto e o histórico da conversa não pertencem ao contexto inicial. Se um arquivo crescer por vários modos independentes, separe referências por modo mantendo um único caminho canônico para cada regra.
