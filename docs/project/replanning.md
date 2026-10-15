# Replanejamento do KuruttinaBot

Os novos planejamentos do projeto ficam no [Notion do KuruttinaBot](https://app.notion.com/p/KuruttinaBot-3dff122a9b1b80ab8e80d8b72f83ee19). O registro abaixo preserva o contexto da revisão iniciada em outubro de 2026.

Direção aprovada pelo responsável pelo produto em 11 de outubro de 2026. Este documento centraliza o inventário, as decisões aprovadas e o que ainda precisa ser escolhido. O [estado implementado](current-state.md) descreve o runtime; as instruções de execução permanecem em [desenvolvimento](development.md).

## Direção aprovada

- KuruttinaBot é um **bot multifuncional para comunidades Discord**. Loritta é a referência de abrangência indicada pelo responsável, sem implicar cópia de identidade, funcionalidades ou arquitetura. Moderação e emojis são capacidades já implementadas, não a finalidade exclusiva do produto.
- A identidade é própria. A referência anterior à personagem foi descartada por completo e não deve reaparecer como inspiração secundária, tema opcional ou alternativa futura.
- O nome KuruttinaBot permanece provisoriamente. Voz feminina, cortesia, elegância, confiança e emojis expressivos são traços do produto, conforme a [personalidade](bot-personality.md).
- A paleta do protótipo anterior e o cinza dos embeds (`0x2b2d31`) estão descartados como proposta de identidade. A nova paleta, a tipografia, a composição e a existência ou não de mascote ainda não estão aprovados.
- Toda a stack será reavaliada por custo, simplicidade operacional, confiabilidade e facilidade de migração. A escolha web foi definida em 14 de outubro de 2026: React sem Next.js, com base própria e liberdade de organização; veja a [decisão](../decisions/react-base.md). As demais escolhas continuam sob revisão.
- Novas funcionalidades e sua ordem dependem de prioridades de produto. O catálogo atual não autoriza restringir o propósito nem preencher um roadmap com funcionalidades presumidas.

## Como interpretar esta revisão

**Implementado:** bot, configuração e persistência existentes no checkout. A Home local React/Vite existe; autenticação e painel ainda não. Supabase e R2 seguem os contratos documentados; contas remotas não foram reconferidas nesta revisão.

**Aprovado:** propósito multifuncional, identidade própria, descarte da identidade anterior, descarte das paletas anteriores como proposta, critérios para a revisão técnica, desde 14 de outubro de 2026 a hospedagem na VPS KingHost e, desde 15 de outubro de 2026, o [login exclusivo via Discord](../decisions/discord-only-authentication.md). A aprovação do login não implementa autenticação nem painel.

**Em revisão:** escolhas tecnológicas ainda abertas, inclusive plano do banco e provedor de assets. Esse status não revoga os contratos operacionais vigentes nem declara uma substituição concluída. Isolamento de ambientes, autorização, proteção de secrets, backup e recuperação continuam requisitos.

**Pendente de execução:** retirada dos elementos visuais antigos, preparação real da VPS e as demais escolhas futuras. A atualização de 14 de outubro de 2026 preparou o contrato no repositório; não inspecionou a máquina, o DNS nem os túneis.

## Inventário da identidade a descartar

As menções à personagem e à obra nesta seção servem exclusivamente para localizar o material a retirar. A busca abrangeu texto e nomes de arquivos locais não ignorados, incluindo `.agents`, sem consultar secrets, histórico Git, dependências ou inventários remotos. Os números de linha abaixo se referem ao levantamento inicial; os trechos identificadores permitem localizar as ocorrências após edições.

| Localização e evidência | Impacto | Tratamento e estado |
| --- | --- | --- |
| [Personalidade](bot-personality.md), abertura original: Kurumi Tokisaki, Date A Live, roleplay, série e apresentação como personagem. | Vinculava a voz do produto a uma identidade externa. | **Removido das orientações ativas nesta entrega.** A abertura agora estabelece identidade própria. |
| [Personalidade](bot-personality.md), seção Fala, antigo item “Sem bordões, risadinhas ou citações da série”. | Mantinha a série como referencial implícito. | **Reescrito nesta entrega.** A orientação sobre voz independe da obra. |
| Protótipo visual anterior, removido do repositório: imagem externa da personagem e camada sem fundo. | Imagem da identidade descartada. | **Descartado.** Não reaproveitar a imagem nem a personagem. |
| Protótipo visual anterior: vinho `#611814`, dourado `#C6A15B`, creme `#FAF7F2`, superfícies `#F2ECE2` e `#F2E9DF`, fontes Manrope e Inter. | Apresentação anterior da landing. | **Descartada em 12 de outubro de 2026** como proposta de identidade. Não reutilizar essas cores nem essas fontes como ponto de partida. |

Não foram encontradas referências textuais diretas à personagem ou à obra no código do runtime pesquisado. Isso não comprova ausência em pixels, emojis ou assets externos.

### Outras referências visuais e de produto

| Localização | Evidência e tratamento |
| --- | --- |
| [README](../../README.md), apresentação do produto. | O propósito estava restrito à administração de comunidades. **Corrigido** para bot multifuncional; a lista atual passou a identificar funcionalidades implementadas. |
| Protótipo visual anterior, removido do repositório. | “Moderação · Emojis · Comunidade” deve ser revisto como apresentação do produto na etapa visual, distinguindo exemplos atuais de propósito. |
| Protótipo visual anterior, removido do repositório. | Texto de TypeScript, Node.js, discord.js, PostgreSQL e Supabase registrava a stack da época; revisar após a decisão técnica, sem apresentá-la como promessa definitiva. |
| Protótipo visual anterior, removido do repositório. | Botão Dashboard e indicadores Online, 128 servidores, 24.860 membros, 12d 08h e 99,98% não têm comprovação operacional. Não publicar esses números; o painel ainda não existe. |
| Embeds do runtime: `commands/public/ping.ts`; `commands/mod/ban.ts`, `kick.ts`, `timeout.ts`, `untimeout.ts`, `unban.ts`; `infrastructure/discord/emojis/emojiInfo.ts`, todos sob `apps/bot/src/`. | Usam `0x2b2d31`. | **Descartada em 12 de outubro de 2026** como proposta de paleta. A cor permanece só como implementação atual dos embeds, até a paleta nova substituí-la. |
| [Personalidade](bot-personality.md) e [catálogo de emojis](emoji-catalog.md). | Exemplos de falas, cor dos embeds, nomes de emojis e alternativas Unicode continuam documentando os contratos existentes. A nova identidade não exige renomear emojis por suposição. |
| Processamento de imagens, tipos `gifenc` e testes de GIF. | Ocorrências de “paleta” descrevem quantização/compressão, não identidade visual. Fora das alterações de marca. |
| Nome KuruttinaBot, pacotes `@kuruttina/*`, prefixos `k!`/`K!`, nomes de bucket e túneis. | Identificadores atuais não serão renomeados por semelhança nominal. O nome permanece provisório; mudanças futuras exigem inventário de consumidores e compatibilidade. |

O protótipo já continha alterações locais do usuário no início da tarefa. Elas foram preservadas. O inventário descreve o arquivo local, sem classificá-lo como versão publicada ou design aprovado.

## Inventário das decisões técnicas e do planejamento

| Escolha ou premissa | Fontes locais | Estado e próxima decisão |
| --- | --- | --- |
| TypeScript/ESM, Node.js, discord.js e monorepo com bot, configuração e banco. | [Manifesto npm](../../package.json), [arquitetura](../agents/architecture.md), [estado atual](current-state.md). | Implementados. Avaliar adequação às necessidades futuras sem presumir reescrita. |
| Hospedagem Square Cloud, `MEMORY=512`, build antes do start. | [ADR histórico](../decisions/square-cloud-supabase.md). O manifesto `squarecloud.app` foi removido do checkout. | **Histórico.** Substituída em 14 de outubro de 2026 pela VPS KingHost. A capacidade da VPS ainda não foi medida. |
| Bot e Home na mesma VPS, com túnel para a Home. | [ADR da VPS](../decisions/vps-kinghost.md), [deploy](../../.agents/skills/project-operations/references/deployment.md). | **Decidido.** A execução no repositório é Docker Compose, com gerenciamento previsto pelo painel externo. As unidades `systemd` são o runtime anterior. A origem remota do túnel de produção foi alinhada; a publicação na máquina não foi verificada. |
| PostgreSQL no Supabase Free, dois projetos separados por ambiente. | [ADR da VPS](../decisions/vps-kinghost.md), que preserva o isolamento do [ADR histórico](../decisions/square-cloud-supabase.md); [banco](../agents/database.md), [segurança](../agents/security.md), `packages/database`. | Contrato operacional preservado. Plano e provedor continuam **em revisão**. Comparar operação, limites, recuperação e portabilidade; preservar isolamento e menor privilégio. |
| Cloudflare R2 como origem pública compartilhada, caminhos relativos e `ASSETS_BASE_URL` por consumidor. | [ADR de assets](../decisions/cloudflare-r2-assets.md), [regras de assets](../agents/assets.md). | Contrato atual **em revisão**. Reconferir volume, tráfego, domínio, proveniência, backup e necessidade de mídia antes da escolha. Não baixar o bucket para o repositório. |
| React sem Next.js, com base/framework próprio. | [Decisão web](../decisions/react-base.md), [skill do website](../../.agents/skills/website-developer/SKILL.md). | **Aprovado em 14 de outubro de 2026.** Liberdade de organização e composição; Home atual usa Vite, TypeScript, Tailwind e servidor Node. Autenticação e painel continuam pendentes. |
| Login do site exclusivamente via Discord. | [Decisão](../decisions/discord-only-authentication.md), [Home](site.md), [referência de autenticação](../../.agents/skills/website-developer/references/authentication-and-admin.md). | **Aprovado em 15 de outubro de 2026.** Sem cadastro local, senha ou outro serviço de login. Usuários privilegiados ficam em `bot_private.bot_staff`. Autenticação e painel ainda não estão implementados. |
| Docker Compose para produção e desenvolvimento; PostgreSQL descartável nativo para testes. | [ADR da VPS](../decisions/vps-kinghost.md), [deploy](../../.agents/skills/project-operations/references/deployment.md), [desenvolvimento](development.md), [testes](../agents/testing.md). | Compose está no repositório. A proibição anterior de Docker é histórica. Os testes de integração continuam com PostgreSQL nativo descartável. RAM e logs no painel ADM, e a API externa de tokens, permanecem intenções futuras, sem integração implementada. |
| Duas credenciais Discord no processo e operação cross-bot. | [ADR de credenciais](../decisions/dual-bot-credentials.md), [Discord](../agents/discord-bot.md), [acesso](bot-access.md). | Implementado, com exceção e controles registrados. Nenhuma credencial ou autorização foi alterada na mudança de hospedagem. Railway aparece nesse ADR apenas como histórico. |
| Logs humanos em produção. | [ADR de logs](../decisions/human-readable-bot-logs.md). | Decisão vigente sobre o formato. Nos contêineres a aplicação emite stdout/stderr. O journal é o destino das unidades `systemd` legadas. Reavaliar se a ingestão passar a exigir JSON. |
| Organização de comandos e packages opcionais. | [ADR do catálogo](../decisions/command-catalog-layout.md), [organização do bot](bot-file-organization.md), arquitetura. | Fronteiras vigentes. Categorias técnicas não limitam o propósito multifuncional; não criar camadas sem consumidores. |
| Ferramentas de R2, sincronização de emojis e launcher local de túnel aposentadas. | [Registro de aposentadoria](tooling-retirement.md), [inventário de túneis](cloudflare-tunnel.md). | Histórico preservado. O contrato novo usa `cloudflared` com configuração remota; os launchers não voltam. O inventário registra a consulta de 14 de outubro de 2026. |
| Roteamento e procedimentos dos agentes. | [AGENTS.md](../../AGENTS.md), [skill de operações](../../.agents/skills/project-operations/SKILL.md), guias de domínio. | O roteador aponta para a skill de operação. A referência de hospedagem foi atualizada com a VPS; as demais revisões técnicas continuam nos itens acima. |

As quantidades, limites de planos e comparações de preço nos ADRs antigos são contexto histórico. A futura comparação usará fontes oficiais atualizadas, data da consulta e medições próprias; esta entrega não valida ofertas comerciais nem recomenda substitutos.

## Próximas etapas e critérios de conclusão

| Etapa | Decisão necessária | Resultado esperado |
| --- | --- | --- |
| 1. Prioridades funcionais | Quais necessidades de comunidades atender primeiro e quais fluxos web são necessários. | Escopo priorizado pelo responsável, separando existente, proposto e adiado, sem funcionalidades inventadas. |
| 2. Nova identidade visual | Paleta, tipografia, composição e existência ou não de mascote próprio. | Direção aprovada, legível e acessível; plano de aplicação no bot e no site, com retirada das imagens e camadas inventariadas. |
| 3. Comparação técnica | Orçamento, carga esperada, disponibilidade e recuperação desejadas para o que ainda está em aberto. A hospedagem já tem decisão. | Comparação por custo total, esforço de operação, confiabilidade e portabilidade; ADRs substitutos com justificativa, impacto e controles. |
| 4. Implementação | Sequência das mudanças aprovadas e critérios de aceite. | Planos de compatibilidade, testes, rollback e migração quando necessários; atualização conjunta de código e documentação. |

Responsável pelas escolhas de produto e aprovação das decisões: Athos Montarroyos. A hospedagem aprovada é a VPS KingHost. Este documento não fixa prazo, orçamento da máquina nem funcionalidades adicionais.

## Validação e pendências desta entrega

- Revisão textual das referências locais à identidade descartada, dos vínculos entre documentos e da distinção entre implementação e planejamento.
- A alteração da personalidade preserva português brasileiro, voz feminina, clareza, serenidade em erros/recusas, limites de segurança e uso de emojis com alternativa Unicode. Consultados integralmente a personalidade e o catálogo. Nenhuma fala implementada ou exemplo de resposta foi alterado; os caminhos do runtime não foram exercitados nesta entrega.
- As referências à personagem restantes no protótipo e no nome do asset local são pendências explícitas de retirada, não escolhas válidas para a nova identidade.
- Não foram inspecionados o conteúdo visual dos binários, a imagem fora do repositório, assets do R2, imagens dos Application Emojis, Discord Developer Portal, contas de hospedagem, banco remoto ou DNS. A revisão desses materiais deverá verificar vínculos visuais adicionais e proveniência sem presumir que nomes de emojis revelam seu conteúdo.
- Não foram executados deploy, migration, exclusão de assets ou mudanças de credenciais. Esta revisão não comprova o estado dos serviços em produção.
