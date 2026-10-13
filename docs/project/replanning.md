# Replanejamento do KuruttinaBot

Direção aprovada pelo responsável pelo produto em 11 de outubro de 2026. Este documento centraliza o inventário, as decisões aprovadas e o que ainda precisa ser escolhido. O [estado implementado](current-state.md) descreve o runtime; as instruções de execução permanecem em [desenvolvimento](development.md).

## Direção aprovada

- KuruttinaBot é um **bot multifuncional para comunidades Discord**. Loritta é a referência de abrangência indicada pelo responsável, sem implicar cópia de identidade, funcionalidades ou arquitetura. Moderação e emojis são capacidades já implementadas, não a finalidade exclusiva do produto.
- A identidade é própria. A referência anterior à personagem foi descartada por completo e não deve reaparecer como inspiração secundária, tema opcional ou alternativa futura.
- O nome KuruttinaBot permanece provisoriamente. Voz feminina, cortesia, elegância, confiança e emojis expressivos são traços do produto, conforme a [personalidade](bot-personality.md).
- A paleta do protótipo anterior e o cinza dos embeds (`0x2b2d31`) estão descartados como proposta de identidade. A nova paleta, a tipografia, a composição e a existência ou não de mascote ainda não estão aprovados.
- Toda a stack será reavaliada por custo, simplicidade operacional, confiabilidade e facilidade de migração. Nenhum fornecedor ou framework substituto foi escolhido.
- Novas funcionalidades e sua ordem dependem de prioridades de produto. O catálogo atual não autoriza restringir o propósito nem preencher um roadmap com funcionalidades presumidas.

## Como interpretar esta revisão

**Implementado:** bot, configuração e persistência existentes no checkout. A operação com Square Cloud, Supabase e R2 é a documentada; contas e serviços remotos não foram reconferidos nesta entrega. O site ainda não existe.

**Aprovado:** propósito multifuncional, identidade própria, descarte da identidade anterior, descarte das paletas anteriores como proposta e critérios para a revisão técnica.

**Em revisão:** escolhas tecnológicas e planos futuros inventariados abaixo. Esse status não equivale a revogar controles operacionais, autorizar migração ou declarar concluída uma substituição. As regras atuais continuam vigentes até a decisão substituta correspondente. Isolamento de ambientes, autorização, proteção de secrets, backup e recuperação continuam requisitos.

**Pendente de execução:** retirada dos elementos visuais antigos e implementação das escolhas futuras. Esta entrega altera somente documentação; código, APIs, banco, infraestrutura, imagens e protótipo permanecem intactos.

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
| Uma aplicação Square Cloud, `MEMORY=512`, build antes do start. | [Manifesto Square](../../squarecloud.app), [deploy](../agents/deployment.md), [desenvolvimento](development.md). | Configuração local existente. Capacidade contratada, consumo real e disponibilidade remotos não reconferidos. Avaliar orçamento e operação. |
| Bot e futuro site como processos da mesma aplicação. | [ADR Square/Supabase](../decisions/square-cloud-supabase.md), arquitetura e deploy. | Plano anterior **em revisão**. Site não implementado. Comparar isolamento de falhas, deploy independente e custo antes de escolher topologia. |
| PostgreSQL no Supabase Free, dois projetos separados por ambiente. | ADR Square/Supabase, [banco](../agents/database.md), [segurança](../agents/security.md), `packages/database`. | Contrato atual, provedor e plano **em revisão**. Comparar operação, limites, recuperação e portabilidade; preservar isolamento e menor privilégio. |
| Cloudflare R2 como origem pública compartilhada, caminhos relativos e `ASSETS_BASE_URL` por consumidor. | [ADR de assets](../decisions/cloudflare-r2-assets.md), [regras de assets](../agents/assets.md). | Contrato atual **em revisão**. Reconferir volume, tráfego, domínio, proveniência, backup e necessidade de mídia antes da escolha. Não baixar o bucket para o repositório. |
| Next.js App Router, React e Tailwind para o painel. | [Guia do site](../agents/nextjs.md), arquitetura. | Plano anterior **em revisão**, sem aplicação implementada. Definir primeiro os fluxos e depois a stack. Controles de autenticação e autorização continuam necessários. |
| Não usar Docker/Compose; PostgreSQL descartável nativo para testes. | ADR Square/Supabase, deploy, desenvolvimento e [testes](../agents/testing.md). | Restrição e fluxo atuais. Avaliar necessidade de containers; não reintroduzir ferramentas nesta etapa. |
| Duas credenciais Discord no processo e operação cross-bot. | [ADR de credenciais](../decisions/dual-bot-credentials.md), [Discord](../agents/discord-bot.md), [acesso](bot-access.md). | Implementado, com exceção e controles registrados. Incluir gestão de secrets na revisão; nenhuma credencial ou autorização alterada. Railway aparece no ADR apenas como histórico. |
| Logs humanos em produção. | [ADR de logs](../decisions/human-readable-bot-logs.md). | Decisão vigente. Reavaliar ingestão e observabilidade conforme a operação escolhida. |
| Organização de comandos e packages opcionais. | [ADR do catálogo](../decisions/command-catalog-layout.md), [organização do bot](bot-file-organization.md), arquitetura. | Fronteiras vigentes. Categorias técnicas não limitam o propósito multifuncional; não criar camadas sem consumidores. |
| Ferramentas de R2, sincronização de emojis e túnel aposentadas. | [Registro de aposentadoria](tooling-retirement.md), [inventário de túneis](cloudflare-tunnel.md). | Histórico preservado. Túneis e DNS remotos não foram inspecionados; não reativar ferramentas por cópia. |
| Roteamento e procedimentos dos agentes. | [AGENTS.md](../../AGENTS.md), [skill de operações](../../.agents/skills/project-operations/SKILL.md), guias de domínio. | O roteador aponta para este documento. Procedimentos atuais continuam orientando manutenção; revisar referências operacionais quando houver decisão técnica substituta. |

As quantidades, limites de planos e comparações de preço nos ADRs antigos são contexto histórico. A futura comparação usará fontes oficiais atualizadas, data da consulta e medições próprias; esta entrega não valida ofertas comerciais nem recomenda substitutos.

## Próximas etapas e critérios de conclusão

| Etapa | Decisão necessária | Resultado esperado |
| --- | --- | --- |
| 1. Prioridades funcionais | Quais necessidades de comunidades atender primeiro e quais fluxos web são necessários. | Escopo priorizado pelo responsável, separando existente, proposto e adiado, sem funcionalidades inventadas. |
| 2. Nova identidade visual | Paleta, tipografia, composição e existência ou não de mascote próprio. | Direção aprovada, legível e acessível; plano de aplicação no bot e no site, com retirada das imagens e camadas inventariadas. |
| 3. Comparação técnica | Orçamento, carga esperada, disponibilidade e recuperação desejadas. | Comparação por custo total, esforço de operação, confiabilidade e portabilidade; ADRs substitutos com justificativa, impacto e controles. |
| 4. Implementação | Sequência das mudanças aprovadas e critérios de aceite. | Planos de compatibilidade, testes, rollback e migração quando necessários; atualização conjunta de código e documentação. |

Responsável pelas escolhas de produto e aprovação das decisões: Athos Montarroyos. Não há prazo, orçamento, fornecedor substituto ou conjunto adicional de funcionalidades aprovado neste documento.

## Validação e pendências desta entrega

- Revisão textual das referências locais à identidade descartada, dos vínculos entre documentos e da distinção entre implementação e planejamento.
- A alteração da personalidade preserva português brasileiro, voz feminina, clareza, serenidade em erros/recusas, limites de segurança e uso de emojis com alternativa Unicode. Consultados integralmente a personalidade e o catálogo. Nenhuma fala implementada ou exemplo de resposta foi alterado; os caminhos do runtime não foram exercitados nesta entrega.
- As referências à personagem restantes no protótipo e no nome do asset local são pendências explícitas de retirada, não escolhas válidas para a nova identidade.
- Não foram inspecionados o conteúdo visual dos binários, a imagem fora do repositório, assets do R2, imagens dos Application Emojis, Discord Developer Portal, contas de hospedagem, banco remoto ou DNS. A revisão desses materiais deverá verificar vínculos visuais adicionais e proveniência sem presumir que nomes de emojis revelam seu conteúdo.
- Não foram executados deploy, migration, exclusão de assets ou mudanças de credenciais. Esta revisão não comprova o estado dos serviços em produção.
