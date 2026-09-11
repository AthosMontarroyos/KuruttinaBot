# ADR: Square Cloud Hobby com Supabase

## Contexto

O Railway Free bloqueia o deploy atual e o plano pago cobra assinatura antes do consumo. O Square Cloud Hobby oferece o deploy automático e os recursos esperados para `bot` e `site`, mas não inclui database. O Square Cloud Standard adiciona capacidade muito acima da necessidade atual apenas para liberar banco. O Supabase Free permite dois projetos ativos, suficientes para separar development e production, enquanto o Pro só se justifica quando receita, criticidade ou limites observados cobrirem seu custo.

## Decisão

`bot` e `site` serão unidades implantáveis separadas no Square Cloud Hobby. PostgreSQL será gerenciado no Supabase, com exatamente um projeto para development e outro para production. Testes automatizados e staging efêmero usam PostgreSQL local descartável; nenhum deles usa o banco de production.

Supabase é a direção permanente, não uma ponte para o database da Square. Quando o Free deixar de atender, o primeiro caminho de evolução é aumentar o plano/capacidade no próprio Supabase, condicionado a necessidade observada e sustentabilidade financeira do projeto. Não será mantida uma segunda arquitetura de persistência específica da Square.

O código permanece compatível com PostgreSQL e acessa dados somente no servidor por `packages/database`. Schema, migrations, roles, grants e policies ficam versionados no repositório. Recursos proprietários do Supabase só entram mediante necessidade explícita e nova decisão quando criarem lock-in relevante.

## Impacto e controles

- Development e production têm URLs, senhas, chaves, OAuth callbacks e dados distintos, sem fallback ou compartilhamento.
- O browser não recebe conexão PostgreSQL, senha, secret key nem `service_role`. A Data API não expõe schemas da aplicação sem decisão e políticas específicas.
- Runtimes usam roles de menor privilégio; credencial owner/migration existe apenas no fluxo controlado de migration.
- O Supabase Free pode pausar projeto de baixa atividade e não oferece backup automático. Pausa é aceita em development; production exige monitoramento de disponibilidade e procedimento documentado de retomada. Dados irrecuperáveis exigem backup lógico externo, criptografado e com restauração testada antes de depender do Free.
- A comunicação Square–Supabase usa TLS, pooling e limites de conexão compatíveis com o plano. Regiões devem ser escolhidas próximas quando possível.
- Upgrade depende de limite real, requisito de disponibilidade/backup ou receita; não é antecipado apenas por crescimento hipotético.

Responsável: AthosMontarroyos.

## Alternativas rejeitadas

- Railway pago: modelo de assinatura mais consumo não é aceitável para o projeto.
- Square Cloud Standard com database: custo e recursos superdimensionados para liberar uma única capacidade.
- VPS/PostgreSQL self-hosted: perde a praticidade e eficácia do deploy automático priorizadas pelo responsável.
- Banco de development e production no mesmo projeto/schema: isolamento insuficiente e maior impacto de erro operacional.

## Revisão

Reavaliar quando o Supabase Free atingir limite mensurável, a pausa/ausência de backup deixar de ser aceitável ou o projeto gerar receita que sustente o plano superior.
