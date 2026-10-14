# Inventário dos túneis Cloudflare

## Histórico de setembro de 2026

Foram configurados `kuruttina-development` (`ef7d23f9-b164-45a1-b316-f45a02045102`) e `kuruttina-production` (`b1460ee3-03f7-49e7-a35c-12d6a6f07ba7`), com CNAMEs `kuruttina.dev.athosmontarroyos.com` e `kuruttina.athosmontarroyos.com`. Na época a origem registrada era `http://localhost:3666`. Os launchers locais e a validação do manifesto de túneis foram aposentados. A configuração remota permanece fora deste repositório. Veja o [registro de ferramentas aposentadas](tooling-retirement.md). Não reative esses launchers.

## Conferido em 14 de outubro de 2026

Consulta à API da Cloudflare, na conta do domínio `athosmontarroyos.com`:

- O CNAME `kuruttina.athosmontarroyos.com` continua proxied e aponta para `b1460ee3-03f7-49e7-a35c-12d6a6f07ba7.cfargotunnel.com`. Ele não foi alterado.
- O túnel `kuruttina-production` usa configuração remota. A regra de `kuruttina.athosmontarroyos.com` passou de `http://localhost:3666` para `http://127.0.0.1:3666`. A regra final `http_status:404` e `warp-routing` desativado foram preservados. A versão da configuração ficou em 2.
- Não havia conector ativo antes nem depois da alteração. O túnel permanece `inactive`.
- O CNAME e o túnel de development não foram modificados. `kuruttina.dev.athosmontarroyos.com` continua apontando para `ef7d23f9-b164-45a1-b316-f45a02045102.cfargotunnel.com`.

O bot não usa o túnel. A porta HTTP não deve ser aberta para acesso externo direto. Token e credenciais do conector ficam no serviço `cloudflared`, fora dos processos Node.

## Ainda não publicado

Não há `cloudflared` em execução para esse túnel. Preencher `/etc/kuruttina/site.env` e instalar ou iniciar o conector na VPS continuam pendentes. Sem o conector, o domínio não entrega `/healthz`, a Home nem os assets. Essa verificação pública só vale depois da ativação na máquina.
