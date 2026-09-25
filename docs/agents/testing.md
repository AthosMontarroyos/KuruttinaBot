# Desenvolvimento, testes e conclusão

Leia este documento quando alterar código, CI, contratos ou automações. Execute os comandos npm essenciais da [referência de desenvolvimento](../project/development.md) e mantenha instalação pelo lockfile.

**MUST:** Rode typecheck, testes relevantes e build limpo dos módulos alterados. Regra de negócio recebe teste unitário; schema, migration e RLS recebem integração com PostgreSQL real descartável; boundary HTTP/auth recebe integração; fluxo crítico recebe ponta a ponta quando viável. Relate falhas não relacionadas.

**MUST:** Casos de autorização e RLS incluem usuário ausente/errado, guilda ou tenant diferente, payload adulterado, role sem privilégio, DDL negado, função não concedida, alteração maliciosa de `search_path`, grants/defaults e acesso após revogação. Sessões/OAuth, quando existirem, cobrem replay e expiração de `state`, redirect divergente, rotação, timeout e sessão privilegiada revogada. Testes não usam projeto Supabase de production, token Discord real ou `.env` operacional.

**SHOULD:** Testes são herméticos; mocks servem para APIs externas e integração real fica em ambiente development autorizado. Lint e format verificam imports, promises, tipos e fronteiras quando configurados. Não edite migration já aplicada; crie correção versionada.

**SHOULD:** Atualize a referência de desenvolvimento, `.env.example` e documentação do contrato sempre que o modo de operar mudar. O README apresenta o produto, suas funcionalidades e licença; atualize-o quando esses aspectos mudarem, mantendo instruções de execução e configuração na documentação de manutenção. Registre decisão duradoura em ADR curto. Remova código morto e não versione outputs, segredos ou dumps. Commits pequenos não descartam mudanças alheias.

## Skills locais

As três skills são `discordbot-developer`, `database-developer` e `project-operations`. Escolha uma principal pelo artefato; consulte documentos de outros domínios quando a mudança cruzar suas regras. Segurança, arquitetura, Next.js e testes permanecem nos documentos de domínio; a skill instalada de Next.js pode orientar o futuro site. Skills não repetem as regras globais.

## Definition of Done

Confirme, conforme o risco: escopo proporcional; dependências sem ciclo; entrada validada; autorização server-side; secrets fora de artefatos/logs; queries e pools limitados; startup/shutdown corretos; testes e build aprovados; documentação e ADR atualizados; resultado com validação e riscos materiais.
