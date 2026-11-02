# Desenvolvimento, testes e conclusão

Leia este documento quando alterar código, CI, contratos ou automações. Execute os comandos npm essenciais da [referência de desenvolvimento](../../../../docs/project/development.md) e mantenha instalação pelo lockfile.

**MUST:** `npm run typecheck` e `npm run site build` regeneram `packages/command-catalog/catalog.js` a partir dos módulos do bot; commite o arquivo gerado junto com a mudança de commands e nunca o edite à mão. Rode typecheck, testes relevantes e build limpo dos módulos alterados. Regra de negócio recebe teste unitário; schema, migration e RLS recebem integração com PostgreSQL real descartável; boundary HTTP/auth recebe integração; fluxo crítico recebe ponta a ponta quando viável. Relate falhas não relacionadas.

**MUST:** Casos de autorização e RLS incluem usuário ausente/errado, guilda ou tenant diferente, payload adulterado, role sem privilégio, DDL negado, função não concedida, alteração maliciosa de `search_path`, grants/defaults e acesso após revogação. Sessões/OAuth, quando existirem, cobrem replay e expiração de `state`, redirect divergente, rotação, timeout e sessão privilegiada revogada. Testes não usam projeto Supabase de production, token Discord real ou `.env` operacional.

**SHOULD:** Testes são herméticos; mocks servem para APIs externas e integração real fica em ambiente development autorizado. Lint e format verificam imports, promises, tipos e fronteiras quando configurados. Não edite migration já aplicada; crie correção versionada.

**SHOULD:** Atualize a referência de desenvolvimento e a documentação do contrato sempre que o modo de operar mudar. Segredos ficam no Doppler, nos configs `dev` e `prd`. O README apresenta o produto, suas funcionalidades e licença; atualize-o quando esses aspectos mudarem, mantendo instruções de execução e configuração na documentação de manutenção. Registre decisão duradoura em ADR curto. Remova código morto e não versione outputs, segredos ou dumps. Commits pequenos não descartam mudanças alheias.

**SHOULD:** Com um worktree do kuru ativo em `.kuru/worktrees/`, `npm test` e `npx vitest run` na raiz executam também os testes copiados dele, e esses falham (sem `node_modules` próprio); `tests/app-runner.test.ts` também falha, porque o `vitest list` do runner enxerga arquivos a mais (nem `--exclude '.kuru/**'` evita essa falha). Dois testes de processo desse arquivo também falharam no Windows sem causa investigada. `tests/database.integration.test.ts` exige PostgreSQL e fica ignorado sem ele. Não atribua essas falhas à mudança sem comparar. A suíte completa pode deixar um arquivo vazio chamado `{` na raiz (origem não investigada): apague-o e não o inclua em commit.

## Definition of Done

Confirme, conforme o risco: escopo proporcional; dependências sem ciclo; entrada validada; autorização server-side; secrets fora de artefatos/logs; queries e pools limitados; startup/shutdown corretos; testes e build aprovados; documentação e ADR atualizados; resultado com validação e riscos materiais.

Quando a tarefa envolver mensagens do bot ao usuário, cumpra também a [leitura e conferência obrigatórias das falas](../../../CLAUDE.md#falas-do-bot), registrando no resultado a validação e as limitações encontradas.
