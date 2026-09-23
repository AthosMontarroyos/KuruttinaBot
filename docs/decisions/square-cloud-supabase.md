# ADR: aplicação única Square Cloud para o produto; Supabase isolado

## Contexto

O monorepo implementa hoje somente o bot. A decisão anterior previa bot e futuro site como aplicações Square Cloud separadas, mas o projeto agora quer uma configuração única. PostgreSQL já é operado em dois projetos Supabase Free, separados por ambiente. As ferramentas de desenvolvimento serão migradas gradualmente para n8n.

## Decisão

O produto terá uma aplicação Square Cloud e um `squarecloud.app` na raiz. Atualmente o comando inicia somente o bot. Quando o site existir, site e bot serão processos distintos na mesma aplicação, supervisionados com shutdown coordenado; só o site escutará a porta HTTP. Essa entrada exigirá orçamento e medição de memória para os dois processos. A equipe hospedará o n8n separadamente, sem dependência do produto e sem manifesto Square adicional neste repositório.

PostgreSQL permanece no Supabase Free: exatamente um projeto development e um production, sem compartilhamento de dados ou credenciais. Testes usam PostgreSQL descartável. Não haverá Docker/Compose neste repositório.

## Consequências e controles

- Bot e futuro site compartilharão ciclo de deploy e falha da aplicação; readiness e parada de ambos devem ser observáveis antes de habilitar o site.
- Secrets e permissões de bot, site, banco administrativo e n8n permanecem separados por função, mesmo na aplicação compartilhada.
- Migrations são operação de release serializada, não parte de startup. O runtime recebe role de menor privilégio.
- n8n exige memória própria, autenticação, chave e dados persistentes com backup/restauração verificáveis antes de ativar fluxos.
- Supabase Free pode pausar e não fornece backup automático; dados irrecuperáveis precisam de backup externo criptografado e restauração testada.
- Reavaliar a topologia se medição demonstrar OOM, indisponibilidade por falha acoplada ou necessidade concreta de deploy independente.

Responsável: AthosMontarroyos. Esta decisão substitui a topologia de aplicações Square Cloud separadas do ADR anterior; preserva sua decisão sobre Supabase.
