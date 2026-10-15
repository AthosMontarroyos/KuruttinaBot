# Logs humanos do bot em produção

Status — 15 de outubro de 2026: a apresentação humana permanece. A menção à Square Cloud abaixo é o contexto histórico da decisão. Nos contêineres, a aplicação continua emitindo stdout e stderr. O journal é o destino das unidades `systemd` legadas. Coleta ou exibição pelo painel ADM não está implementada.

## Contexto

O bot emitia JSON estruturado em production e apresentação humana em development. Na Square Cloud, os logs eram inspecionados diretamente por pessoas e o JSON reduzia a leitura rápida em relação ao terminal local.

## Decisão e aprovação

Por solicitação e aprovação explícita do responsável pelo projeto em 13 de setembro de 2026, o runtime do bot usa a mesma apresentação humana em development e production. Esta é uma exceção específica do bot à regra geral de JSON estruturado em produção.

## Impacto e controles compensatórios

- Ferramentas que esperem uma linha JSON por evento não poderão consumir diretamente esses logs.
- Eventos, categorias e metadata permanecem centralizados e semanticamente estáveis no mesmo formatter.
- `info` e `success` continuam em stdout; `warn` e `error`, em stderr.
- Production nunca usa ANSI. Redirecionamento, `NO_COLOR` e `TERM=dumb` também impedem cores.
- Tokens, mensagens de erro potencialmente sensíveis e objetos grandes continuam fora dos campos emitidos pelos consumidores.

## Condição de revisão

Reavaliar esta exceção quando a ingestão, no journal legado ou em outro coletor, passar a exigir JSON ou oferecer formatter configurável por ambiente.
