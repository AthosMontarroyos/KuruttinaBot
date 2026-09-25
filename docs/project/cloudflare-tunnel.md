# Inventário dos túneis Cloudflare

Em setembro de 2026 foram configurados `kuruttina-development` (`ef7d23f9-b164-45a1-b316-f45a02045102`) e `kuruttina-production` (`b1460ee3-03f7-49e7-a35c-12d6a6f07ba7`), com CNAMEs `kuruttina.dev.athosmontarroyos.com` e `kuruttina.athosmontarroyos.com`, ambos apontando para a origem local `http://localhost:3666`. O site ainda não existe; iniciar connector não torna essa origem disponível.

Os launchers locais e a validação do manifesto de túneis foram aposentados. A configuração remota permanece fora deste repositório; não houve exclusão de túnel ou DNS. Não há connector ou serviço de automação incluído no projeto; consulte o [registro de ferramentas aposentadas](tooling-retirement.md) antes de planejar nova implementação.
