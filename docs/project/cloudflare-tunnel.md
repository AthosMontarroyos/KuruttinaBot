# Inventário dos túneis Cloudflare

Em setembro de 2026 foram configurados `kuruttina-development` (`ef7d23f9-b164-45a1-b316-f45a02045102`) e `kuruttina-production` (`b1460ee3-03f7-49e7-a35c-12d6a6f07ba7`), com CNAMEs `kuruttina.dev.athosmontarroyos.com` e `kuruttina.athosmontarroyos.com`, ambos apontando para a origem local `http://localhost:3666`. O site ainda não existe; iniciar connector não torna essa origem disponível.

Os launchers locais e a validação do manifesto de túneis foram aposentados. A configuração remota permanece fora deste repositório; não houve exclusão de túnel ou DNS. Consulte o [catálogo de migração](n8n-migration.md) antes de reativar: o connector precisa rodar na máquina que alcança a origem, com token do ambiente correto, e development/production não devem conectar simultaneamente à mesma origem local. O n8n remoto não substitui esse connector.
