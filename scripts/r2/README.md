# R2 Cloud Manager

Gerencia o bucket R2 via Cloudflare API sem baixar arquivos para o projeto.

## Regra Principal

**NUNCA** baixe arquivos do R2 para o repositório. O projeto acessa os arquivos via URL pública quando necessário.

## Configuração

Adicione no `.env` (no repositório raiz):

```bash
CLOUDFLARE_ACCOUNT_ID=seu_account_id
CLOUDFLARE_API_TOKEN=seu_token_api
```

CLI, ponte WebDAV e sincronizador de emojis compartilham `scripts/r2/client.mjs`. A leitura usa `dotenv`, sem popular `process.env`; variáveis do processo têm precedência sobre o `.env`. O cliente centraliza paginação, codificação das chaves, timeout e retry limitado para `429` nas operações JSON.

### Como obter as credenciais

1. **Account ID:**
   - Acesse: https://dash.cloudflare.com
   - O Account ID está na página "Visão Geral" ou na URL

2. **API Token:**
   - Acesse: https://dash.cloudflare.com/profile/api-tokens
   - Crie um token com permissões:
     - `Cloudflare R2: Read`
     - `Cloudflare R2: Write`
   - Recurso: bucket `kurrutina-bot-pictures`

## Fluxo de trabalho — CLI

Gerencia o bucket remotamente via Cloudflare API:

```bash
# Listar todos os arquivos
npm run r2 -- list

# Listar arquivos de uma pasta específica
npm run r2 -- list Pictures

# Ver informações de um arquivo
npm run r2 -- info Pictures/minha-imagem.png

# Upload de arquivo
npm run r2 -- upload ./minha-imagem.png Pictures/nova.png

# Upload de pasta inteira
npm run r2 -- upload ./minha-pasta Pictures/minha-pasta

# Deletar arquivo
npm run r2 -- delete Pictures/antigo.png

# Ver tamanho total do bucket
npm run r2 -- size
```

Aliases npm equivalentes:

```bash
npm run r2:list
npm run r2:info Pictures/minha-imagem.png
npm run r2:upload ./minha-imagem.png Pictures/nova.png
npm run r2:delete Pictures/antigo.png
npm run r2:size
```

## Fluxo de trabalho — Montagem local (rclone)

Monta o bucket inteiro como sistema de arquivos em `R2/` usando rclone e uma ponte WebDAV local. **Esta é uma ferramenta manual de manutenção; o bot não monta o bucket no startup.**

### Pré-requisitos

- **Linux/WSL** — os scripts dependem de `/proc` e funcionalidades de montagem FUSE.
- **Node.js** — necessário para o `r2-webdav-bridge.mjs`.
- **rclone** — binário em `.tools/rclone/rclone` (não versionado no Git).
- **jq** — necessário para gerenciamento de estado.
- **FUSE** — suporte a filesystem no kernel. Utilitários de montagem compatíveis incluem `fusermount3` (FUSE 3) e `fusermount` (FUSE 2), geralmente fornecidos com as dependências do rclone.
- **Credenciais Cloudflare** no `.env` — `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN`.
- **Porta 3762** — usada pela ponte WebDAV; não pode estar em uso.

### Instalar o rclone

1. Baixe de https://rclone.org/downloads/
2. Coloque o binário em `.tools/rclone/rclone`
3. Dê permissão de execução: `chmod +x .tools/rclone/rclone`

### Comandos

```bash
# Montar o bucket inteiro em R2/
npm run r2:mount

# Desmontar
npm run r2:unmount
```

### Como funciona

1. `mount-r2-pictures.sh` inicia o `r2-webdav-bridge.mjs` em `localhost:3762`.
2. O bridge traduz operações WebDAV para a Cloudflare API.
3. O rclone monta o bridge como filesystem via FUSE em `R2/`.
4. O estado é persistido em `.tools/r2-mount/rclone-state.json`.
5. A configuração gerada para o rclone fica em `.tools/r2-mount/rclone.conf`.
6. Logs operacionais ficam em `.tools/r2-mount/rclone.log` e `.tools/r2-mount/bridge.log`.

### Comportamento da montagem

O script verifica se já existe um estado de montagem ativo. Se o PID registrado corresponder a um processo rclone válido (mesmo executável e ponto de montagem na linha de comando), o script informa que o bucket já está montado e sai. Caso contrário, descarta o estado obsoleto e inicia uma nova montagem. O diretório `R2/` precisa estar vazio antes da montagem.

### Validação de desmontagem

A desmontagem trata cada estado de forma diferente:

| Estado | Comportamento |
|---|---|
| PID do rclone ativo, executável e linha de comando compatíveis | Encerra o rclone e espera até 5 segundos; encerra a bridge e remove o estado. |
| PID do rclone ativo, executável ou linha de comando incompatíveis | Retorna erro sem encerrar nenhum processo; preserva o estado. |
| PID do rclone inativo | Remove o estado obsoleto sem encerrar processos. |
| Arquivo de estado legado (PID file) com processo ativo | Retorna erro sem encerramento forçado — exige verificação manual. |
| Arquivo de estado legado com processo inativo | Remove o arquivo legado. |
| Rclone não encerra dentro de 5 segundos | Retorna erro; estado preservado para nova verificação. |

O horário registrado em `startedAtUtc` no estado não é comparado com o horário de criação do processo. A bridge é encerrada pelo PID salvo quando ativo; não recebe a mesma verificação de identidade (executável e cmdline) aplicada ao rclone.

## Sincronização de Emojis

```bash
# Sincronizar Application Emojis de production para R2/emojis/
npm run emoji:r2:sync

# Sincronizar para R2 E espelhar no BotDev
npm run emoji:sync
```

### Comportamento dos comandos de emojis

Os comandos usam Application Emojis do bot de **produção** como origem.

| Comando | Origem | Destino R2 | Espelhamento Discord |
|---|---|---|---|
| `emoji:r2:sync` | Application Emojis production | `emojis/` no R2 | — |
| `emoji:sync` | Application Emojis production | `emojis/` no R2 | Aplicação de desenvolvimento |

**Ordem de operação:**

1. Valida a configuração Discord e R2, sem exigir montagem local, rclone ou FUSE.
2. Valida a identidade da aplicação de produção e obtém seus Application Emojis em memória.
3. Envia os arquivos ao R2 sequencialmente, substituindo objetos de mesma chave.
4. Após **todos** os uploads e a listagem completa terminarem com sucesso, remove objetos excedentes somente do prefixo `emojis/`.
5. No modo completo (`emoji:sync`), espelha o conjunto na aplicação de desenvolvimento: substitui emojis alterados e remove excedentes.

**Nota:** os uploads substituem objetos à medida que são concluídos; a exclusão de excedentes só ocorre após sucesso completo dos uploads. O processo não é uma transação atômica — uma falha pode deixar parte das atualizações aplicada.

## URL Pública

O bucket está configurado para acesso público via:
```
https://pub-271b6233fa924c46b0aa8664e8587f3f.r2.dev/
```

Para acessar um arquivo em `Pictures/minha-imagem.png`:
```
https://pub-271b6233fa924c46b0aa8664e8587f3f.r2.dev/Pictures/minha-imagem.png
```

`ASSETS_BASE_URL` representa a URL pública dos assets. O bot atual não a consome nem a inclui em sua configuração tipada. Quando existir uma feature de mídia, sua composição deverá validar a URL HTTPS e injetá-la no consumidor, sem leitura direta de `process.env` na feature.

## Estrutura do Bucket

```
kurrutina-bot-pictures/
├── Roleplay/
│   ├── dance/       # GIFs de dança
│   ├── hug/         # GIFs de abraço
│   ├── kiss/        # GIFs de beijo
│   └── slap/        # GIFs de tapa
├── avatars/         # Avatares de usuários
├── branding/        # Logos e headers
├── dashboard/       # Imagens do dashboard
├── emojis/          # Emojis customizados
└── icons/           # Ícones gerais
```

## Regras Importantes

1. **NUNCA baixe arquivos do R2** — Use URLs públicas para leitura
2. **Use caminhos relativos estáveis** — Não mude nomes de arquivos existentes
3. **Mantenha organização** — Use as pastas existentes
4. **Valide tamanhos** — GIFs animados podem ser grandes; comprima antes de upload
5. **Teste URLs** — Após upload, verifique se a URL pública funciona
