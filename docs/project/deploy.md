# Publicação

A publicação de produção acontece quando uma GitHub Release é publicada. O workflow [deploy.yml](../../.github/workflows/deploy.yml) executa, na tag dessa release, as verificações do workflow de qualidade e só então atualiza a VPS. O mesmo workflow pode ser executado manualmente com uma tag.

Os segredos `VPS_HOST`, `VPS_USER` e `VPS_SSH_KEY` ficam apenas no GitHub, no ambiente `production`. Eles não são versionados.

Para rollback, execute o workflow Publicar produção manualmente e informe a tag anterior.

A publicação dos comandos Discord não entra nesse fluxo. Ela é manual, pelo workflow [publish-commands.yml](../../.github/workflows/publish-commands.yml), no mesmo ambiente e na mesma fila.

O checkout na VPS é `/home/deploy/Projects/KuruttinaBot`. A VPS precisa de `git`, `curl` e `docker compose`, e o checkout precisa conseguir buscar as tags no origin. `docker compose build` constrói `bot` e `site`; a imagem `migrate`, do profile `release`, só é construída quando `DATABASE_MIGRATION_URL_PRODUCTION` está preenchida no `.env` da raiz. Não há seed. Falha ao subir os serviços, ou na espera de até 120s pelo log `Bot pronto` e por HTTP 200 em `https://kuruttina.athosmontarroyos.com/healthz`, restaura o commit anterior e sobe `bot` e `site` de novo. Essa restauração não desfaz migrations. A VPS ainda não foi conferida por esta mudança.
