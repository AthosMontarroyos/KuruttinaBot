# Assets

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 12. Assets no Cloudflare R2

### Regra: finalidade e organização

**Nível:** MUST

**Regra:** o bucket Cloudflare R2 `kurrutina-bot-pictures` é a origem operacional compartilhada das imagens reutilizáveis pelo bot, site e demais consumidores. O repositório não versiona `R2/` nem cópias divergentes dentro dos apps; backups ficam fora do repositório e possuem responsável humano.

### Regra: acesso via cloud (sem download)

**Nível:** MUST

**Regra:** NENHUM arquivo do R2 deve ser baixado para o repositório. O projeto acessa os arquivos diretamente via URL pública quando necessário. As ferramentas CLI e de montagem local foram aposentadas e não há automação de gerenciamento de bucket incluída no projeto; o gerenciamento ocorre fora deste repositório. Consulte o [registro de ferramentas aposentadas](../project/tooling-retirement.md). Features consumidoras leem pela `ASSETS_BASE_URL` HTTPS quando existir, sem receber credenciais de escrita. Nunca baixe, copie ou versione arquivos do bucket no repositório.

### Regra: espelho de Application Emojis

**Nível:** MUST

**Regra:** `R2/emojis/` permanece como diretório plano destinado ao espelho dos Application Emojis do bot principal. Este repositório não é dono desse espelho: não o atualiza, não remove objetos e não confere divergência com o Discord. O sincronizador foi aposentado; qualquer operação administrativa ocorre fora deste projeto. O importador atual do bot aplica o limite de 256 KiB às criações no Discord e não lê o bucket.

### Regra: integração com o site

**Nível:** MUST

**Regra:** cada feature de bot ou site que realmente consuma mídia recebe a mesma `ASSETS_BASE_URL` HTTPS validada em sua composição e persiste somente caminhos relativos estáveis. Processos sem consumidor não exigem nem recebem essa variável. O runtime monta URLs públicas sem credenciais do R2; nenhuma imagem é copiada para o build ou para a área pública do site. Em produção, use domínio próprio conectado ao bucket; `r2.dev` é provisório por ser limitado e não recomendado pela Cloudflare para produção.

### Regra: otimização e distribuição

**Nível:** SHOULD

**Regra:** Prefira SVG para vetores seguros e WebP/AVIF para raster quando compatível; comprima, remova metadata desnecessária e defina dimensões. Copie para o build/imagem somente assets usados pela aplicação.

### Regra: proveniência e limpeza

**Nível:** MUST

**Regra:** Asset externo precisa de licença/proveniência compatível registrada antes do upload. Remova duplicados e assets não utilizados após confirmar referências; não versione binários, artefatos temporários ou exportações enormes.
