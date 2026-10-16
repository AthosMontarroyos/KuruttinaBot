# Publicação

A publicação de produção acontece automaticamente depois que o workflow de qualidade passa num push para `main`. O workflow [deploy.yml](../../.github/workflows/deploy.yml) recebe esse resultado e publica exatamente o commit verificado. A passagem para publicação por GitHub Release fica planejada para o lançamento da primeira versão.

Para rollback, execute o workflow Publicar produção manualmente e informe o SHA do commit anterior. O disparo manual também aceita uma tag e roda as verificações de qualidade nessa ref antes de publicar.

Os segredos `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e `VPS_KNOWN_HOSTS` ficam apenas no GitHub, no ambiente `production`. Eles não são versionados. `VPS_KNOWN_HOSTS` é a chave de host fixada.

A publicação dos comandos Discord não entra nesse fluxo. Ela é manual, pelo workflow [publish-commands.yml](../../.github/workflows/publish-commands.yml), no mesmo ambiente e na mesma fila.

O checkout na VPS é `/home/deploy/Projects/KuruttinaBot`. A VPS precisa de `git`, `curl` e `docker compose`, e o checkout precisa conseguir buscar `origin/main` e as tags. O commit publicado fica em checkout destacado e precisa ser alcançável a partir de `origin/main`. A publicação automática não substitui o checkout por um ancestral que ele já contém. `docker compose build` constrói `bot` e `site`; a imagem `migrate`, do profile `release`, só é construída quando `DATABASE_MIGRATION_URL_PRODUCTION` está preenchida no `.env` da raiz. Não há seed. Falha ao subir os serviços, ou na espera de até 120s pelo log `Bot pronto` e por HTTP 200 em `https://kuruttina.athosmontarroyos.com/healthz`, restaura o commit anterior e sobe `bot` e `site` de novo. Essa restauração não desfaz migrations. A VPS ainda não foi conferida por esta mudança.
