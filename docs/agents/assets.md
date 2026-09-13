# Assets

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 12. Assets no Cloudflare R2

### Regra: finalidade e organização

**Nível:** MUST

**Regra:** o bucket Cloudflare R2 `kurrutina-bot-pictures` é a origem operacional compartilhada das imagens reutilizáveis pelo bot, site e demais consumidores. O repositório não versiona o mount virtual `R2/` nem cópias divergentes dentro dos apps; backups ficam fora do repositório e possuem responsável humano.

No ambiente Windows de desenvolvimento, `npm run r2:mount` monta o bucket inteiro na pasta virtual `R2/` da raiz por meio do perfil local `kurrutina-r2` do rclone; `npm run r2:unmount` encerra a montagem. A sincronização de emojis garante esse mount automaticamente e escreve no prefixo `emojis/`. O executável, cache, PID e credenciais permanecem ignorados pelo Git.

### Regra: catálogo visual de emojis

**Nível:** MUST

**Regra:** `R2/emojis/manifest.json`, gerado por `npm run emojis:sync`, é o inventário canônico para agentes e ferramentas escolherem emojis: registra Team, aplicação proprietária, ID, nome, animação e caminho visual. `R2/emojis/index.html` é somente uma galeria humana. Antes de referenciar um emoji, sincronize, consulte o manifesto e inspecione visualmente o WebP montado; não use o nome do arquivo como prova de significado, ownership ou animação.

### Regra: integração com o site

**Nível:** MUST

**Regra:** cada feature de bot ou site que realmente consuma mídia recebe a mesma `ASSETS_BASE_URL` HTTPS validada em sua composição e persiste somente caminhos relativos estáveis. Processos sem consumidor não exigem nem recebem essa variável. O runtime monta URLs públicas sem credenciais do R2; nenhuma imagem é copiada para o build ou para a área pública do site. Em produção, use domínio próprio conectado ao bucket; `r2.dev` é provisório por ser limitado e não recomendado pela Cloudflare para produção.

### Regra: otimização e distribuição

**Nível:** SHOULD

**Regra:** Prefira SVG para vetores seguros e WebP/AVIF para raster quando compatível; comprima, remova metadata desnecessária e defina dimensões. Copie para o build/imagem somente assets usados pela aplicação.

### Regra: proveniência e limpeza

**Nível:** MUST

**Regra:** Asset externo precisa de licença/proveniência compatível registrada antes do upload. Remova duplicados e assets não utilizados após confirmar referências; não versione binários, artefatos temporários ou exportações enormes.
