# Assets

> Referência da skill. Leia as seções aplicáveis à operação, incluindo seus requisitos e exceções; não carregue os demais assuntos preventivamente.

## 12. Assets no Cloudflare R2

### Regra: finalidade e organização

**Nível:** MUST

**Regra:** o bucket Cloudflare R2 `kurrutina-bot-pictures` é a origem operacional compartilhada das imagens reutilizáveis pelo bot, site e demais consumidores. O repositório não versiona `R2/` nem cópias divergentes dentro dos apps; backups ficam fora do repositório e possuem responsável humano.

### Regra: acesso via cloud (sem download)

**Nível:** MUST

**Regra:** NENHUM arquivo do R2 deve ser baixado para o repositório. O projeto acessa os arquivos diretamente via URL pública quando necessário. As ferramentas CLI e de montagem local foram aposentadas e não há automação de gerenciamento de bucket incluída no projeto; o gerenciamento ocorre fora deste repositório. Consulte o [registro de ferramentas aposentadas](../../../../docs/project/tooling-retirement.md). Features consumidoras leem pela `ASSETS_BASE_URL` HTTPS quando existir, sem receber credenciais de escrita. Nunca baixe, copie ou versione arquivos do bucket no repositório.

### Regra: espelho de Application Emojis

**Nível:** MUST

**Regra:** `R2/emojis/` permanece como diretório plano destinado ao espelho dos Application Emojis do bot principal. Este repositório não é dono desse espelho: não o atualiza, não remove objetos e não confere divergência com o Discord. O sincronizador foi aposentado; qualquer operação administrativa ocorre fora deste projeto. O importador atual do bot aplica o limite de 256 KiB às criações no Discord e não lê o bucket.

### Regra: integração com o site

**Nível:** MUST

**Regra:** cada feature de bot ou site que realmente consuma mídia recebe a mesma `ASSETS_BASE_URL` HTTPS validada em sua composição e persiste somente caminhos relativos estáveis. Processos sem consumidor não exigem nem recebem essa variável. O runtime monta URLs públicas sem credenciais do R2; nenhuma imagem é copiada para o build ou para a área pública do site. Em produção, use domínio próprio conectado ao bucket; `r2.dev` é provisório por ser limitado e não recomendado pela Cloudflare para produção.

### Regra: SVGs locais do site por função

**Nível:** MUST

**Regra:** cada SVG de interface em `apps/site/public/icons/` fica numa subpasta cujo nome é a função do ícone. A raiz `icons/` não recebe arquivo. Variantes da mesma função, como desktop e celular, compartilham a pasta. Funções atuais: `theme/` (troca de tema), `account/` (conta), `language/` (idioma), `community/` (Discord do bot) e `social/` (redes do criador). Ícone novo reutiliza a pasta da função ou cria outra com o nome da função; não misture marcas externas com controles da página. O caminho público e a allowlist do servidor mudam no mesmo cambio. Esta regra não cobre mídia do R2: avatar e demais objetos remotos continuam fora de `public/`.

### Regra: otimização e distribuição

**Nível:** SHOULD

**Regra:** Prefira SVG para vetores seguros e WebP/AVIF para raster quando compatível; comprima, remova metadata desnecessária e defina dimensões. Copie para o build/imagem somente assets usados pela aplicação.

### Regra: proveniência e limpeza

**Nível:** MUST

**Regra:** Asset externo precisa de licença/proveniência compatível registrada antes do upload. Remova duplicados e assets não utilizados após confirmar referências; não versione binários, artefatos temporários ou exportações enormes.
