---
name: discordbot-developer
description: Criar, corrigir ou revisar commands, slash/prefixo, handlers, falas, permissões e runtime Discord do KuruttinaBot. Usar para tarefas em apps/bot mesmo sem menção explícita à skill.
metadata:
  short-description: Desenvolvimento do bot Discord
---

# Bot Discord

## Procedimento

1. Localize o command, executor e adapters envolvidos. Para criar ou mover arquivos, leia [organização do bot](../../../docs/project/bot-file-organization.md). Confirme a versão instalada de discord.js no manifesto/lockfile.
2. Para commands, leia as seções contrato/carregamento e categorias de [contratos locais](references/project-contracts.md). Defina categoria, `access`, `scope`, execução raiz ou rotas e a documentação obrigatória (descrição, `help.topic` e `examples` com slash e prefixo; regra "documentação obrigatória do command"); mantenha slash e `k!`/`K!` no mesmo executor. Não edite lista de commands à mão: `/help`, a página `/comandos` do site e a publicação no Discord leem o command carregado. Helpers ficam fora do catálogo. Alteração no contrato deve alcançar os dois adapters.
3. Para bootstrap, sync ou credenciais, leia as seções correspondentes de [contratos locais](references/project-contracts.md). Valide identidade antes de Gateway/publicação; nunca faça PUT a cada reconexão. Para memória/shutdown, leia memória, estado distribuído e ciclo de vida nessa referência.
4. Para qualquer fala afetada, leia integralmente [personalidade](../../../docs/project/bot-personality.md) e [catálogo de emojis](../../../docs/project/emoji-catalog.md). Confira também recusas, erros e fallback de emoji; não altere autorização para acomodar a copy.
5. Valide com `npm run typecheck` (ele regenera o catálogo do site), testes relevantes de commands/adapters e `npm run bot build`. O startup do bot sincroniza os commands com o Discord por diferença, sem flag; `npm run deploy:commands` publica sempre. Integração Discord só no ambiente autorizado; publicar commands é operação externa. Na conclusão, informe validação e caminhos não exercitados.

## Referências condicionais

- [discordjs-core](references/discordjs-core.md): Client, imports, cache ou estrutura.
- [interactions-components](references/interactions-components.md): resposta/defer, components ou modals.
- [gateway-rest-scale](references/gateway-rest-scale.md): Gateway, REST, filas ou rate limits.
- [security-permissions-policy](references/security-permissions-policy.md): instalação, OAuth ou permissões Discord.
- [limits](references/limits.md) e [versions-and-sources](references/versions-and-sources.md): investigar limite ou compatibilidade; valores variáveis exigem fonte oficial atual.
- [Segurança local](../project-maintenance/references/security.md): selecione entrada/autorização/erros para novos handlers; SSRF/uploads para URLs ou importação; secrets para credenciais/logs.
- [Validação](../project-maintenance/references/validation.md): contrato compartilhado, autorização ou mudança de infraestrutura de testes.

Persistência aciona `database-developer`; deploy aciona `project-operations`. Guarde procedimentos descobertos nesta skill ou na referência pertinente, sem copiar o estado inteiro do projeto.
