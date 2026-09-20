# Assets

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 12. Assets no Cloudflare R2

### Regra: finalidade e organização

**Nível:** MUST

**Regra:** o bucket Cloudflare R2 `kurrutina-bot-pictures` é a origem operacional compartilhada das imagens reutilizáveis pelo bot, site e demais consumidores. O repositório não versiona o mount virtual `R2/` nem cópias divergentes dentro dos apps; backups ficam fora do repositório e possuem responsável humano.

### Regra: acesso via cloud (sem download)

**Nível:** MUST

**Regra:** NENHUM arquivo do R2 deve ser baixado para o repositório. O projeto acessa os arquivos diretamente via URL pública quando necessário. O gerenciamento do bucket é feito por:

- **CLI** (`scripts/r2/r2-cloud.mjs`): lista, consulta, faz upload e deleta via Cloudflare API.
- **Montagem local** (`npm run r2:mount`): ferramenta manual de manutenção que monta o bucket como filesystem via rclone e ponte WebDAV. Requer Linux/WSL, rclone, jq e FUSE.

- **Leitura:** Via `ASSETS_BASE_URL` quando existir uma feature consumidora; até lá, não integra o contrato do bot
- **Escrita:** Via `npm run r2` (Cloudflare API com credenciais) ou montagem local
- **NUNCA:** Baixar, copiar ou versionar arquivos do R2 no repositório

### Regra: espelho de Application Emojis

**Nível:** MUST

**Regra:** `R2/emojis/` é um diretório plano, sem subpastas, e espelha integralmente os Application Emojis do bot principal. `npm run emoji:r2:sync` substitui arquivos de mesmo nome e remove objetos excedentes somente depois que todos os uploads terminarem com sucesso. `npm run emoji:sync` executa essa substituição e então espelha o mesmo conjunto no BotDev. A transferência usa memória e APIs remotas; não persiste cópias dos emojis no repositório. Uploads são sequenciais, respeitam `429` e rejeitam Application Emojis acima de 256 KiB antes de alterar os destinos.

### Regra: integração com o site

**Nível:** MUST

**Regra:** cada feature de bot ou site que realmente consuma mídia recebe a mesma `ASSETS_BASE_URL` HTTPS validada em sua composição e persiste somente caminhos relativos estáveis. Processos sem consumidor não exigem nem recebem essa variável. O runtime monta URLs públicas sem credenciais do R2; nenhuma imagem é copiada para o build ou para a área pública do site. Em produção, use domínio próprio conectado ao bucket; `r2.dev` é provisório por ser limitado e não recomendado pela Cloudflare para produção.

### Regra: otimização e distribuição

**Nível:** SHOULD

**Regra:** Prefira SVG para vetores seguros e WebP/AVIF para raster quando compatível; comprima, remova metadata desnecessária e defina dimensões. Copie para o build/imagem somente assets usados pela aplicação.

### Regra: proveniência e limpeza

**Nível:** MUST

**Regra:** Asset externo precisa de licença/proveniência compatível registrada antes do upload. Remova duplicados e assets não utilizados após confirmar referências; não versione binários, artefatos temporários ou exportações enormes.
