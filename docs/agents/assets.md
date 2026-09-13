# Assets

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 12. Assets no Cloudflare R2

### Regra: finalidade e organização

**Nível:** MUST

**Regra:** o bucket Cloudflare R2 `kurrutina-bot-pictures` é a origem operacional compartilhada das imagens reutilizáveis pelo bot, site e demais consumidores. O repositório não versiona `Pictures/` nem cópias divergentes dentro dos apps; backups ficam fora do repositório e possuem responsável humano.

No ambiente Windows de desenvolvimento, `npm run assets:mount` monta esse bucket em `Pictures/` por meio do perfil local `kurrutina-r2` do rclone; `npm run assets:unmount` encerra a montagem. O executável, cache, PID e credenciais permanecem ignorados pelo Git.

### Regra: integração com o site

**Nível:** MUST

**Regra:** cada feature de bot ou site que realmente consuma mídia recebe a mesma `ASSETS_BASE_URL` HTTPS validada em sua composição e persiste somente caminhos relativos estáveis. Processos sem consumidor não exigem nem recebem essa variável. O runtime monta URLs públicas sem credenciais do R2; nenhuma imagem é copiada para o build ou para a área pública do site. Em produção, use domínio próprio conectado ao bucket; `r2.dev` é provisório por ser limitado e não recomendado pela Cloudflare para produção.

### Regra: otimização e distribuição

**Nível:** SHOULD

**Regra:** Prefira SVG para vetores seguros e WebP/AVIF para raster quando compatível; comprima, remova metadata desnecessária e defina dimensões. Copie para o build/imagem somente assets usados pela aplicação.

### Regra: proveniência e limpeza

**Nível:** MUST

**Regra:** Asset externo precisa de licença/proveniência compatível registrada antes do upload. Remova duplicados e assets não utilizados após confirmar referências; não versione binários, artefatos temporários ou exportações enormes.
