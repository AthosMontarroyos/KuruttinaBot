# Publicação

A publicação de produção acontece automaticamente depois que o workflow de qualidade passa num push para `main`. O workflow [deploy.yml](../../.github/workflows/deploy.yml) recebe esse resultado e publica exatamente o commit verificado. A passagem para publicação por GitHub Release fica planejada para o lançamento da primeira versão.

Para rollback, execute o workflow Publicar produção manualmente e informe o SHA do commit anterior. O disparo manual também aceita uma tag e roda as verificações de qualidade nessa ref antes de publicar.

Os segredos `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e `VPS_KNOWN_HOSTS` ficam apenas no GitHub, no ambiente `production`. Eles não são versionados. `VPS_KNOWN_HOSTS` é a chave de host fixada. `DOPPLER_TOKEN` nesse mesmo ambiente é usado só pelo workflow de emoji. O deploy e a publicação de comandos não o enviam por SSH.

A publicação dos comandos Discord não entra nesse fluxo. Ela é manual, pelo workflow [publish-commands.yml](../../.github/workflows/publish-commands.yml), no mesmo ambiente e na mesma fila. Na VPS o comando é `doppler run -- docker compose ...`.

Application Emojis do bot de produção também ficam fora desse fluxo. O procedimento manual está em [Emojis de produção](emojis-prod.md): o workflow [emoji-prod.yml](../../.github/workflows/emoji-prod.yml) usa o mesmo ambiente `production` e só cria o emoji depois da aprovação dos revisores.

O checkout na VPS é `/home/deploy/Projects/KuruttinaBot`. A VPS precisa de `git`, `curl`, `docker compose` e `doppler`, e o checkout precisa conseguir buscar `origin/main` e as tags. O token de serviço somente leitura do config Doppler `prd` fica configurado para o usuário `deploy`, com escopo nesse diretório. O commit publicado fica em checkout destacado e precisa ser alcançável a partir de `origin/main`. A publicação automática não substitui o checkout por um ancestral que ele já contém. `doppler run -- docker compose build` constrói `bot` e `site`; a imagem `migrate`, do profile `release`, só é construída quando `DATABASE_MIGRATION_URL` tem valor no Doppler. Valor vazio pula a migration. O valor não é impresso. Não há seed. Falha ao subir os serviços, ou na espera de até 120s pelo log `Bot pronto` e por HTTP 200 em `https://kuruttina.athosmontarroyos.com/healthz`, restaura o commit anterior e sobe `bot` e `site` de novo. Essa restauração não desfaz migrations. A VPS ainda não foi conferida por esta mudança.

## Checklist de migração para o Doppler

1. Instale a Doppler CLI na VPS, disponível para o usuário `deploy`.
2. No checkout, configure o token de serviço somente leitura do config `prd`: `doppler configure set token ... --scope /home/deploy/Projects/KuruttinaBot`. Isso é manual. O workflow não recebe nem grava esse token.
3. Adicione `DOPPLER_TOKEN` (token de serviço somente leitura do config `prd`) ao ambiente GitHub `production`. Ele serve só a `emoji-prod.yml`.
4. Faça o primeiro deploy com Doppler. Na VPS os comandos são `doppler run -- docker compose ...`.
5. Depois que esse deploy funcionar, apague os segredos do `.env` da VPS e o segredo GitHub `DISCORD_PROD_BOT_TOKEN`.
