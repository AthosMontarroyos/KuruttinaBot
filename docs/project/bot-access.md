# Guilda e contas privilegiadas

O bot usa PostgreSQL no Supabase por `@kuruttina/database`. Tokens Discord e credenciais de conexão permanecem no ambiente; IDs e papéis ficam no banco.

## Cadastros

| Ambiente | Projeto Supabase |
| --- | --- |
| development | Dev Kuruttina Bot. O ref fica em `SUPABASE_PROJECT_REF` no config Doppler `dev`. |
| production | Kuruttina Bot. O ref fica em `SUPABASE_PROJECT_REF` no config Doppler `prd`. |

Os dois projetos receberam a migration e o cadastro inicial em 23/09/2026. Os snowflakes não ficam neste documento. Cada config Doppler guarda o valor daquele ambiente:

- Guilda inicial: `SEED_GUILD_ID`.
- Creator: `SEED_CREATOR_ID`.
- Dev: `SEED_DEV_ID`.

`npm run database:seed` lê esses três nomes do ambiente e não tem valor embutido no código. Nome ausente, valor vazio ou snowflake inválido interrompe o seed antes de conectar. Creator e Dev precisam ser snowflakes distintos.

`bot_private.bot_settings` contém um único registro, só com o ambiente. `bot_private.bot_dev_guilds` contém as guildas de desenvolvimento daquele ambiente, zero ou mais, uma linha por snowflake. A migration `20261102120000_dev_guilds.sql` copia a antiga `dev_guild_id` para essa tabela e remove a coluna. Outras guildas entram por SQL administrativo, não pelo código. `bot_private.bot_staff` contém usuário, papel e status ativo, com um usuário por papel e sem repetição de usuário. IDs são strings de snowflake; não use números JavaScript. `kuruttina_site` não tem `SELECT` em `bot_settings`, `bot_dev_guilds` nem `bot_staff`. O DevMock do site, só em development, chama `bot_private.active_dev_user_id()` e recebe apenas o `user_id` do papel `dev` quando `active` é verdadeiro.

Os cadastros são independentes. Alterar uma conta ou guilda em development não altera production.

## Credenciais e primeiro startup

As conexões dos dois ambientes foram validadas com senhas distintas, usando o pooler IPv4 do projeto (host em `DATABASE_POOLER_HOST`, porta 5432) e a CA oficial Supabase Root 2021. Senha, ref de projeto e host do pooler não são versionados. O processo não lê `SUPABASE_PROJECT_REF` nem `DATABASE_POOLER_HOST`; a conexão continua em `DATABASE_URL`, `SITE_DATABASE_URL` e `DATABASE_MIGRATION_URL`. Cada config Doppler (`dev` e `prd`) guarda `DATABASE_URL` (role `kuruttina_bot`), `SITE_DATABASE_URL` (role `kuruttina_site`) e `DATABASE_CA` daquele projeto.

Para recriar o provisionamento, siga os passos abaixo. A migration cria `kuruttina_owner` (NOLOGIN, owner) e `kuruttina_bot` (LOGIN, sem senha inicial e sem escrita). A senha do projeto/role `postgres` não deve ser usada pelo bot.

1. Conecte administrativamente ao projeto pelo cliente PostgreSQL, usando a conexão indicada no painel Supabase.
2. No psql, execute `\password kuruttina_bot` para definir uma senha forte exclusiva daquele ambiente. O prompt evita colocar a senha em SQL versionado ou no histórico do shell.
3. Copie a conexão do painel, substituindo a role por `kuruttina_bot`; no pooler, preserve o sufixo `.<project-ref>` (o ref é o valor de `SUPABASE_PROJECT_REF` naquele config). Codifique caracteres especiais da senha na URL.
4. Grave `DATABASE_URL` no config Doppler do ambiente (`dev` ou `prd`). O processo do bot recebe somente essa conexão, role `kuruttina_bot`.
5. Grave `SITE_DATABASE_URL` no mesmo config, com a role `kuruttina_site`. Os configs `dev` e `prd` precisam desse nome. O Compose entrega o valor como `DATABASE_URL` só no serviço `site`, junto com `DATABASE_CA`. O bot não recebe `SITE_DATABASE_URL`.
6. Remova query parameters como `sslmode` ou `options`: o código define TLS com verificação de certificado e timeouts. Se a CA do projeto não estiver na cadeia confiável do sistema, forneça o PEM em `DATABASE_CA`. O site e o bot recebem esse PEM.
7. Grave `DATABASE_MIGRATION_URL` no mesmo config, somente para scripts de administração/release. Nome ausente ou valor vazio faz o deploy pular a migration. Nunca injete essa variável no bot nem no site.
8. O startup valida conexão, o registro de ambiente e cada guilda cadastrada antes do Gateway. Um cadastro sem guildas é válido. `APP_ENV` continua distinguindo development de production. Um banco de development é rejeitado por um bot production porque `bot_settings.environment` não confere.

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

O seed usa parâmetros, transação e lock; repetições com dados iguais são inofensivas. Ele só grava a guilda inicial quando `bot_settings` ainda não existe. Uma guilda a mais, a menos ou diferente faz o seed falhar e desfazer a transação, sem alterar o cadastro. Incluir ou tirar guilda é um SQL administrativo, não um seed. Dados divergentes de equipe ou ambiente também não são sobrescritos. Credenciais não fazem parte das migrations.

No Table Editor do Supabase, selecione o schema `bot_private` para editar guildas (`bot_dev_guilds`), usuário ou `active`. O schema não deve ser adicionado aos schemas expostos pela Data API. A alteração de status vale na próxima execução de comando, sem cache ou reinício. A revogação não cancela uma operação já autorizada e iniciada.

## Políticas de comandos

As políticas atuais `public`, `guild` e `staff` estão em uso. O primeiro comando especial real é `dev`, em `apps/bot/src/commands/dev/emoji.ts` — a pasta `dev/` inteira tem escopo `dev-guild` e deploy exclusivo nas guildas cadastradas em `bot_dev_guilds`, validado pelo loader:

```ts
access: {
  kind: 'staff',
  minimumRole: 'dev', // ou 'creator'
  userPermissions: [],
  botPermissions: [PermissionFlagsBits.ViewChannel],
  requireChannelSend: true,
}
```

O mesmo gate protege slash, `k!` e `K!`: uma guilda cadastrada em `bot_dev_guilds` + usuário ativo + papel suficiente + permissões Discord do membro e bot. Creator inclui Dev, mas não dispensa permissões Discord. Ser administrador do servidor não atribui papel interno.

A identidade vem de `interaction.user.id` ou `message.author.id`, nunca de argumentos do comando. A consulta aplica contexto RLS por transação, sem deixar a identidade em conexões reutilizadas. Falha de consulta nega o comando, com resposta sanitizada. Slash é reconhecido antes da consulta.

O dispatcher autoriza a política raiz e, em seguida, os requisitos adicionais da rota, antes de resolver entradas ou iniciar download ou consulta. A rota `emoji → add` (`emoji-add`) importa no servidor. A rota `dev → emoji → add` (`dev-emoji-add`) não baixa a imagem: valida a origem, deriva o nome quando ele falta e, quando há token, dispara o workflow de produção. A rota `emoji → info` (`emoji-info`) usa outro executor e uma porta de consulta injetada no mesmo dispatcher. Requisitos da rota somam permissões; não substituem nem enfraquecem a raiz.

`ping` e `clear` mantêm suas políticas. `/emoji` continua `guild` e global, sem permissão administrativa na raiz e sem `default_member_permissions`: a raiz exige do bot visualização e envio no canal. A rota `add` soma `ManageGuildExpressions` para o membro e `CreateGuildExpressions` para o bot. A rota `info` soma `EmbedLinks` para o bot e fica aberta aos membros do servidor. Nenhuma das duas consulta a equipe. `/dev emoji add` permanece `staff` com escopo `dev-guild`. Com `GITHUB_WORKFLOW_TOKEN`, dispara o workflow de Application Emojis de production e não cria o emoji; sem o token, só orienta o workflow manual. IDs de guilda e equipe não aparecem nos comandos: cada ambiente lê o seu cadastro.

## Publicação e mudança das guildas

`npm run deploy:commands` (sempre publica) e o startup do bot (publica só a diferença, obrigatório, ver [decisão](../decisions/command-sync-on-startup.md)) sincronizam, em sequência, o conjunto global e o conjunto de equipe de cada linha de `bot_dev_guilds`, em ordem de `guild_id`, somente para a aplicação ativa. O conjunto global exclui qualquer módulo de `apps/bot/src/commands/dev/` (`scope: 'dev-guild'`); a pasta `dev/` e seus subdiretórios entram somente nessas guildas. Sem guildas cadastradas, o startup não chama o Discord para esse escopo e segue. Um conjunto vazio de commands limpa os comandos daquele escopo; PUT substitui o conjunto completo. Falha em uma guilda impede o readiness, como nas demais falhas de sync.

Ao incluir uma guilda, insira o snowflake em `bot_private.bot_dev_guilds` com a conexão de migration do ambiente e reinicie o bot, ou rode `npm run deploy:commands`, para publicar o conjunto de equipe nessa guilda.

Ao remover uma guilda:
1. Registre o ID antes de apagar a linha.
2. Apague a linha. O gate recusa a guilda na próxima execução de comando.
3. Remova os commands pelo endpoint oficial `PUT /applications/{applicationId}/guilds/{oldGuildId}/commands` com corpo `[]`, usando a credencial da aplicação correta.
4. Repita para o outro bot quando aplicável.

O bot não procura nem apaga registros de guildas fora do cadastro.

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
- `SETTINGS_MISSING`, `SETTINGS_INVALID` ou `ENVIRONMENT_MISMATCH`: conferir o registro de ambiente, os snowflakes em `bot_dev_guilds` e a correspondência entre banco e ambiente. Cadastro sem guildas não é erro.

As migrations anteriores a `20261102120000_dev_guilds.sql` são aditivas. Essa migration remove `dev_guild_id` depois de copiar o valor: o código anterior não lê o cadastro enquanto a coluna não existir, e o código novo não lê a coluna. Em falha de rollout, não apague as tabelas nem os cadastros; volte o código só junto com o schema compatível. Revise alterações corretivas por nova migration. Os IDs iniciais podem ser reconstruídos pelo seed; alterações posteriores importantes exigem backup externo conforme a política de banco. Em pausa do Supabase, retome o projeto pelo painel antes do startup. Falhas durante a execução bloqueiam comandos restritos; comandos públicos/moderação não consultam o banco.

## Validação realizada

- Typecheck, testes unitários e build do bot aprovados.
- Sete cenários com PostgreSQL descartável aprovados, incluindo RLS e privilégios com login runtime real.
- Conexões development/production verificadas pelo driver pg com TLS e CA oficial.
- Em ambos: Creator/Dev reconhecidos; usuário externo e guilda errada recusados; SELECT de equipe sem contexto vazio; escrita, TEMP e CREATE no schema public não concedidos.
- Security Advisors Supabase sem alertas nos dois projetos após as migrations.
- Nenhum Gateway Discord foi iniciado e nenhum comando foi publicado remotamente nesta implementação.

O estado e as validações atuais devem ser conferidos no CI; resultados históricos pertencem ao Git.
