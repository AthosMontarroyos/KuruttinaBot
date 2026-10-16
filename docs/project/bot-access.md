# Guilda e contas privilegiadas

O bot usa PostgreSQL no Supabase por `@kuruttina/database`. Tokens Discord e credenciais de conexão permanecem no ambiente; IDs e papéis ficam no banco.

## Cadastros

| Ambiente | Projeto Supabase |
| --- | --- |
| development | Dev Kuruttina Bot — `nzpvcxdxwoyjvxqkioam` |
| production | Kuruttina Bot — `ewzbassdebmjtabxpcnh` |

Os dois projetos receberam a migration e o cadastro inicial em 23/09/2026:

- Guilda: `1422623678205657160`.
- Creator: `666948364507545600`.
- Dev: `1509331533348212808`.

`bot_private.bot_settings` contém um único registro, com guilda e ambiente. `bot_private.bot_staff` contém usuário, papel e status ativo, com um usuário por papel e sem repetição de usuário. IDs são strings de snowflake; não use números JavaScript.

Os cadastros são independentes. Alterar uma conta ou guilda em development não altera production.

## Credenciais e primeiro startup

As conexões dos dois ambientes foram validadas com senhas distintas, usando o pooler IPv4 `aws-0-sa-east-1.pooler.supabase.com:5432` e a CA oficial Supabase Root 2021. Nenhuma senha é versionada. Cada config Doppler (`dev` e `prd`) guarda `DATABASE_URL` e `DATABASE_CA` daquele projeto.

Para recriar o provisionamento, siga os passos abaixo. A migration cria `kuruttina_owner` (NOLOGIN, owner) e `kuruttina_bot` (LOGIN, sem senha inicial e sem escrita). A senha do projeto/role `postgres` não deve ser usada pelo bot.

1. Conecte administrativamente ao projeto pelo cliente PostgreSQL, usando a conexão indicada no painel Supabase.
2. No psql, execute `\password kuruttina_bot` para definir uma senha forte exclusiva daquele ambiente. O prompt evita colocar a senha em SQL versionado ou no histórico do shell.
3. Copie a conexão do painel, substituindo a role por `kuruttina_bot`; no pooler, preserve o sufixo `.<project-ref>`. Codifique caracteres especiais da senha na URL.
4. Grave `DATABASE_URL` no config Doppler do ambiente (`dev` ou `prd`). O processo recebe somente a conexão injetada por esse config.
5. Remova query parameters como `sslmode` ou `options`: o código define TLS com verificação de certificado e timeouts. Se a CA do projeto não estiver na cadeia confiável do sistema, forneça o PEM em `DATABASE_CA`.
6. Grave `DATABASE_MIGRATION_URL` no mesmo config, somente para scripts de administração/release. Valor vazio faz o deploy pular a migration. Nunca injete essa variável no bot.
7. O startup valida conexão, presença da guilda e identificação do ambiente antes do Gateway. `APP_ENV` continua distinguindo development de production. Um banco de development é rejeitado por um bot production porque `bot_settings.environment` não confere.

Conexões remotas exigem TLS; sockets/hosts locais previstos só são aceitos na configuração development. A URL não pode carregar opções que sobrescrevam o TLS. O pool tem três conexões, timeout de conexão/statement/transação ociosa de cinco segundos e no máximo doze operações admitidas. O shutdown para novas execuções, aguarda as aceitas, desconecta Discord e fecha o pool, com prazo total de cinco segundos.

## Migrations e cadastro administrativo

Execute uma vez por release, antes de iniciar o bot:

```bash
npm run database:migrate -- development
npm run database:seed -- development
npm run database:migrate -- production
npm run database:seed -- production
```

O runner usa transação, advisory lock e ledger com checksum em `kuruttina_migrations`. Migrations aplicadas são imutáveis. Na aplicação inicial via MCP, o mesmo checksum foi registrado nesse ledger, além do histórico nativo Supabase.

O seed usa parâmetros, transação e lock; repetições com dados iguais são inofensivas. Dados divergentes ou acesso previamente revogado não são sobrescritos: o seed falha e exige uma alteração administrativa explícita. Credenciais não fazem parte das migrations.

No Table Editor do Supabase, selecione o schema `bot_private` para editar guilda, usuário ou `active`. O schema não deve ser adicionado aos schemas expostos pela Data API. A alteração de status vale na próxima execução de comando, sem cache ou reinício. A revogação não cancela uma operação já autorizada e iniciada.

## Políticas de comandos

As políticas atuais `public`, `guild` e `staff` estão em uso. O primeiro comando especial real é `dev`, em `apps/bot/src/commands/dev/emoji.ts` — a pasta `dev/` inteira tem escopo `dev-guild` e deploy exclusivo na guilda cadastrada, validado pelo loader:

```ts
access: {
  kind: 'staff',
  minimumRole: 'dev', // ou 'creator'
  userPermissions: [],
  botPermissions: [PermissionFlagsBits.ViewChannel],
  requireChannelSend: true,
}
```

O mesmo gate protege slash, `k!` e `K!`: guilda cadastrada + usuário ativo + papel suficiente + permissões Discord do membro e bot. Creator inclui Dev, mas não dispensa permissões Discord. Ser administrador do servidor não atribui papel interno.

A identidade vem de `interaction.user.id` ou `message.author.id`, nunca de argumentos do comando. A consulta aplica contexto RLS por transação, sem deixar a identidade em conexões reutilizadas. Falha de consulta nega o comando, com resposta sanitizada. Slash é reconhecido antes da consulta.

O dispatcher autoriza a política raiz e, em seguida, os requisitos adicionais da rota, antes de resolver entradas ou iniciar download ou consulta. As rotas `dev → emoji → add` (`dev-emoji-add`) e `emoji → add` (`emoji-add`) compartilham o executor de importação. A rota `emoji → info` (`emoji-info`) usa outro executor e uma porta de consulta injetada no mesmo dispatcher. Requisitos da rota somam permissões; não substituem nem enfraquecem a raiz.

`ping` e `clear` mantêm suas políticas. `/emoji` continua `guild` e global, sem permissão administrativa na raiz e sem `default_member_permissions`: a raiz exige do bot visualização e envio no canal. A rota `add` soma `ManageGuildExpressions` para o membro e `CreateGuildExpressions` para o bot. A rota `info` soma `EmbedLinks` para o bot e fica aberta aos membros do servidor. Nenhuma das duas consulta a equipe. `/dev emoji add` permanece `staff` com escopo `dev-guild` e só orienta o workflow de Application Emojis de production. IDs de guilda e equipe não aparecem nos comandos: cada ambiente lê o seu cadastro.

## Publicação e mudança da guilda

`npm run deploy:commands` e `AUTO_SYNC_COMMANDS=true` sincronizam, em sequência, o conjunto global e o conjunto de equipe da guilda configurada, somente para a aplicação ativa. O conjunto global exclui qualquer módulo de `apps/bot/src/commands/dev/` (`scope: 'dev-guild'`); a pasta `dev/` e seus subdiretórios entram somente no conjunto da guilda cadastrada. Um conjunto vazio limpa os comandos daquele escopo; PUT substitui o conjunto completo.

Ao trocar a guilda:
1. Registre o ID antigo antes de editar o cadastro.
2. Sincronize os comandos da aplicação ativa com o novo cadastro.
3. Remova os comandos antigos pelo endpoint oficial `PUT /applications/{applicationId}/guilds/{oldGuildId}/commands` com corpo `[]`, usando a credencial da aplicação correta.
4. Repita para o outro bot quando aplicável.

Mesmo antes da limpeza visual, a guilda antiga é recusada pelo gate. O bot não procura nem apaga registros de outras guildas automaticamente.

## Desenvolvimento e testes

`npm run test:database` exige binários PostgreSQL (`initdb` e `pg_ctl`); `pg_config` é usado para localizá-los quando disponível. A própria suíte cria um cluster temporário no diretório temporário do sistema, acessível somente por TCP em `127.0.0.1`, executa a integração com login runtime real e encerra/remove o cluster ao final. Não lê `.env` nem acessa Supabase. `npm test` executa somente os testes herméticos.

Para desenvolvimento persistente, instale PostgreSQL localmente com credenciais descartáveis e URLs distintas das do Supabase. O teste de integração cria seu próprio cluster temporário sem acessar o `.env`.

A CI executa typecheck, testes unitários, PostgreSQL descartável e build. A dependência `pg` (MIT) implementa o protocolo PostgreSQL; `@types/pg` permanece em dependencies porque a Square compila após instalação sem devDependencies. Não há SDK Supabase no runtime.

## Recuperação

Falhas de banco no startup e no deploy central exibem `Database — Falha no acesso ao banco`, com `correlationId`, `operation`, `stage`, `errorCode` e `reason`. `stage=connect` indica aquisição/conexão, `query` indica execução SQL, `validate_settings` indica validação do cadastro e `idle` indica falha em conexão ociosa. Somente códigos reconhecidos e descrições fixas são registrados; mensagens brutas, SQL, credenciais e detalhes do servidor não entram no diagnóstico. Códigos desconhecidos aparecem como `UNKNOWN`.

Exemplos para diagnóstico na Square:

- `SELF_SIGNED_CERT_IN_CHAIN` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE`: conferir a CA oficial em `DATABASE_CA`, como PEM. O carregamento aceita quebras de linha reais, `\n` literal ou espaços entre blocos base64, com ou sem um par de aspas externas. Certificados malformados são rejeitados no startup, sem registrar seu conteúdo. Não desative a verificação TLS.
- `28P01`: conferir usuário runtime e senha do ambiente ativo na URL protegida.
- `ENOTFOUND`, `ENETUNREACH`, `ECONNREFUSED` ou `CONNECTION_TIMEOUT`: conferir endpoint/pooler, conectividade e disponibilidade do projeto Supabase.
- `42501` ou `42P01`: conferir permissões runtime e migrations aplicadas.
- `SETTINGS_MISSING`, `SETTINGS_INVALID` ou `ENVIRONMENT_MISMATCH`: conferir cadastro inicial e correspondência entre banco e ambiente.

Essa migration é aditiva. Em falha de rollout, mantenha as tabelas e volte ao código anterior; não remova os cadastros automaticamente. Revise alterações corretivas por nova migration. Os IDs iniciais podem ser reconstruídos pelo seed; alterações posteriores importantes exigem backup externo conforme a política de banco. Em pausa do Supabase, retome o projeto pelo painel antes do startup. Falhas durante a execução bloqueiam comandos restritos; comandos públicos/moderação não consultam o banco.

## Validação realizada

- Typecheck, testes unitários e build do bot aprovados.
- Sete cenários com PostgreSQL descartável aprovados, incluindo RLS e privilégios com login runtime real.
- Conexões development/production verificadas pelo driver pg com TLS e CA oficial.
- Em ambos: Creator/Dev reconhecidos; usuário externo e guilda errada recusados; SELECT de equipe sem contexto vazio; escrita, TEMP e CREATE no schema public não concedidos.
- Security Advisors Supabase sem alertas nos dois projetos após as migrations.
- Nenhum Gateway Discord foi iniciado e nenhum comando foi publicado remotamente nesta implementação.

O estado e as validações atuais devem ser conferidos no CI; resultados históricos pertencem ao Git.
