# n8n para operações de desenvolvimento

Base adaptada de [Square Cloud Education: n8n-web](https://github.com/squarecloud-education/n8n-web/tree/6023f58846bb740a34de8eff7d5c390f2e7fd88d), revisão `6023f58846bb740a34de8eff7d5c390f2e7fd88d` consultada em 23/09/2026 (licença ISC declarada no pacote original). O projeto original usa `n8n: latest` e `execSync` em `index.js`; esta base fixa a dependência e usa `npm start` para executar o binário instalado diretamente. Ela é independente dos workspaces e do deploy do bot. Não há workflows ativos nesta etapa; veja o [catálogo](../../docs/project/n8n-migration.md).

Node 24 ou superior é obrigatório para a versão fixada. Na pasta `infra/n8n`, execute `npm ci` e `npm start`. Para publicar como aplicação separada na Square, empacote o conteúdo desta pasta como raiz do projeto n8n e configure pelo painel Node.js recomendado, comando `npm start`, porta da plataforma e memória dimensionada para n8n. A base original recomenda 3072 MB. O único `squarecloud.app` versionado pertence ao bot/site.

Defina somente no ambiente protegido da instância n8n:

| Variável | Finalidade |
| --- | --- |
| `N8N_HOST`, `N8N_PORT`, `N8N_PROTOCOL`, `N8N_EDITOR_BASE_URL` | Endereço público HTTPS e porta de escuta conferidos na implantação. |
| `WEBHOOK_URL`, `N8N_PROXY_HOPS` | URLs e proxy conforme a configuração real da Square; não habilite webhook público para operações de dev. |
| `N8N_ENCRYPTION_KEY` | Chave aleatória persistente. Faça backup separado do banco; sua perda inviabiliza as credenciais salvas. |
| `N8N_USER_FOLDER` | Diretório base persistente da instância; o n8n grava o banco em `<diretório>/.n8n/database.sqlite`. |
| `GENERIC_TIMEZONE` | `America/Sao_Paulo`, se os futuros agendamentos precisarem desse fuso. |

Use contas individuais dos desenvolvedores e revise permissões dos workflows. Não conceda shell, filesystem local nem credenciais de migration ao runtime de bot/site. Mantenha o banco de dados n8n separado do Supabase do produto. O padrão SQLite só pode ser usado em produção depois de verificar que o diretório de dados sobrevive a restart e reupload da aplicação Square, com backup e restauração testados; sem essa evidência, não publique fluxos que dependam do estado.

Validação local em WSL/Node 24.21.0: `npm ci` instalou a versão 2.40.5, `npm start` iniciou o editor, `/healthz` respondeu `ok` e o SQLite foi reutilizado após reinício. A instalação tentada no Windows/Node 26.7.0 falhou ao compilar a dependência nativa de Kafka; use WSL com Node 24 para esta base. O runtime emitiu aviso de ausência do Python task runner; não habilite nós Python até configurar e testar um runner externo. Autenticação de pessoas, persistência após reupload na Square e backup/restauração ainda exigem validação antes de ativar workflows. Exporte os fluxos sem credenciais, revise o alvo de cada mutation e execute um teste em development.
