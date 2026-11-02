# Ferramentas locais aposentadas

Registro histórico de ferramentas retiradas do repositório. O projeto não inclui um serviço de automação. Algumas implementações e seus testes podem ser consultados antes da remoção no commit `fb4b1b3`.

| Ferramenta retirada | Comportamento anterior | Estado atual |
| --- | --- | --- |
| Build e limpeza de `dist/` | Removia artefatos, compilava TypeScript e formatava a saída. | O build é executado diretamente pelos comandos npm e validado no CI. |
| Connector Cloudflare Tunnel | Selecionava ambiente, validava manifesto e token e iniciava `cloudflared`. | Launcher aposentado. Túneis e DNS remotos continuam fora deste repositório; veja o [inventário](cloudflare-tunnel.md). |
| Ferramentas Cloudflare R2 | Consultavam, enviavam e removiam objetos por API; a ponte WebDAV montava o bucket via rclone/FUSE. | Ferramentas e montagem local aposentadas. Operações administrativas não estão disponíveis neste projeto. |
| Espelhamento de Application Emojis | Copiava emojis da aplicação production para R2 e, opcionalmente, para a aplicação development. | Sincronizador aposentado; não há rotina automática de espelhamento. |
| Administração do banco | Executava migrations e cadastro inicial com credenciais administrativas. | A implementação versionada vive em `packages/database`; execute-a como operação de release. |
| Integração PostgreSQL | Criava um cluster temporário, testava RLS e privilégios e o removia ao final. | A suíte TypeScript cria e remove o cluster usando APIs do Node. |
| Publicação de comandos Discord | Validava identidade, banco e catálogo e publicava comandos globais e da guilda. | O entrypoint `deploy:commands` continua disponível e publica sempre. O startup do bot passou a sincronizar por diferença ([decisão](../decisions/command-sync-on-startup.md)). |
| Detecção de segredos | Varredura local e no CI. | Gitleaks continua disponível no CI e no comando npm local. |

As ferramentas aposentadas não devem ser reativadas por cópia de versões antigas. Automações executadas fora do projeto devem permanecer sem dependências no monorepo e seguir os requisitos do plano externo.
