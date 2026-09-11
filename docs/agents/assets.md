# Assets

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 12. Assets em `Pictures/`

### Regra: finalidade e organização

**Nível:** MUST

**Regra:** `Pictures/` na raiz é a origem canônica global de todas as imagens reutilizáveis pelo bot, site ou outros consumidores. Armazene ali apenas fontes/assets do projeto, organizados por uso e com nomes kebab-case descritivos; não mantenha cópias versionadas divergentes dentro dos apps. `Pictures/` não é storage de upload, cache, IPC entre serviços nem banco de dados.

### Regra: integração com o site

**Nível:** MUST

**Regra:** Como arquivos públicos do Next.js precisam ser expostos pelo app/build, use um mecanismo explícito e determinístico de mapeamento, sincronização, cópia ou link gerado entre `Pictures/` e a área pública do site, incluindo somente os assets usados. A fonte continua sendo `Pictures/`; a saída gerada não deve ser editada nem versionada. Resolva a partir da raiz/workspace, evitando imports com cadeias frágeis de `../`. O mecanismo deve ser reproduzível em desenvolvimento, CI, Docker e Railway e não pode exigir symlink específico do sistema operacional.

### Regra: otimização e distribuição

**Nível:** SHOULD

**Regra:** Prefira SVG para vetores seguros e WebP/AVIF para raster quando compatível; comprima, remova metadata desnecessária e defina dimensões. Copie para o build/imagem somente assets usados pela aplicação.

### Regra: proveniência e limpeza

**Nível:** MUST

**Regra:** Asset externo precisa de licença/proveniência compatível registrada. Remova duplicados e assets não utilizados após confirmar referências; não versione artefatos temporários ou exportações enormes.
