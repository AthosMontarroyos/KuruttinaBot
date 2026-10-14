# Inventário dos túneis Cloudflare

## Histórico de setembro de 2026

Foram configurados `kuruttina-development` (`ef7d23f9-b164-45a1-b316-f45a02045102`) e `kuruttina-production` (`b1460ee3-03f7-49e7-a35c-12d6a6f07ba7`), com CNAMEs `kuruttina.dev.athosmontarroyos.com` e `kuruttina.athosmontarroyos.com`, ambos apontando na época para `http://localhost:3666`. Os launchers locais e a validação do manifesto de túneis foram aposentados. A configuração remota permanece fora deste repositório; não houve exclusão registrada de túnel ou DNS. Veja o [registro de ferramentas aposentadas](tooling-retirement.md). Não reative esses launchers.

## Contrato previsto em 14 de outubro de 2026

A Home de produção deve aparecer em `kuruttina.athosmontarroyos.com` por `cloudflared` independente, com configuração gerenciada na Cloudflare, encaminhando para `http://127.0.0.1:3666`. O bot não usa o túnel. A porta HTTP não é aberta para acesso externo direto. Token e credenciais do conector ficam no serviço `cloudflared`, fora dos processos Node.

Antes da ativação, confira o túnel, o DNS e os conectores. Reutilize `kuruttina-production` se o hostname e a origem estiverem corretos e nenhum conector antigo ainda encaminhar tráfego para outra máquina. Se não estiver correto, crie o substituto e atualize este inventário. O túnel de development não publica o hostname de produção.

## Ainda não verificado

Nenhuma inspeção remota foi feita nesta preparação. Não está confirmado se os túneis, CNAMEs ou conectores de setembro de 2026 continuam iguais, ativos ou apontando para outra origem.
