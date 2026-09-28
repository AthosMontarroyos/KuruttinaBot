# Catálogo de emojis para agentes

O DevOps do GrokBot mantém este arquivo atualizado pelo GitHub. A IA de código consulta o catálogo diretamente no checkout do repositório para escolher emojis nas mensagens, sem pesquisar no R2 ou consultar o Discord para descobrir o inventário.

## Catálogo

Os nomes abaixo já são referenciados pelo código. A disponibilidade nas aplicações Discord ainda precisa ser documentada pelo GrokBot; `pendente` não significa disponível nem ausente.

Última conferência pelo GrokBot: Development 2026-09-28; Production 2026-09-28.

| Nome | Uso na mensagem | Development | Production |
| --- | --- | --- | --- |
| `dancing` | Resposta animada do ping | disponível | disponível |
| `stats` | Latência da API | disponível | disponível |
| `gateway` | Latência do Gateway | disponível | disponível |
| `warning` | Aviso ou entrada inválida | disponível | disponível |
| `loading` | Operação em andamento | disponível | disponível |
| `cleaning` | Limpeza de mensagens | disponível | disponível |
| `slap` | Complemento expressivo da confirmação de limpeza | disponível | disponível |
| `error` | Falha na operação | disponível | disponível |
| `search` | Busca sem resultados | disponível | disponível |
| `add` | pendente | disponível | disponível |
| `AFFILIATE` | pendente | disponível | disponível |
| `Anger` | pendente | disponível | disponível |
| `API` | pendente | disponível | disponível |
| `ban` | pendente | disponível | disponível |
| `book` | pendente | disponível | disponível |
| `ChannelBrowser` | pendente | disponível | disponível |
| `coffee` | pendente | disponível | disponível |
| `crown` | pendente | disponível | disponível |
| `cry` | pendente | disponível | disponível |
| `developer` | pendente | disponível | disponível |
| `Dice` | pendente | disponível | disponível |
| `DiceRooling` | pendente | disponível | disponível |
| `Disappointed` | pendente | disponível | disponível |
| `Disgusted` | pendente | disponível | disponível |
| `Documentation` | pendente | disponível | disponível |
| `folder` | pendente | disponível | disponível |
| `guild` | pendente | disponível | disponível |
| `Heart` | pendente | disponível | disponível |
| `home` | pendente | disponível | disponível |
| `ID` | pendente | disponível | disponível |
| `info` | pendente | disponível | disponível |
| `kick` | pendente | disponível | disponível |
| `label` | pendente | disponível | disponível |
| `left_arrow` | pendente | disponível | disponível |
| `link` | pendente | disponível | disponível |
| `lock` | pendente | disponível | disponível |
| `logs` | pendente | disponível | disponível |
| `moderation` | pendente | disponível | disponível |
| `mute` | pendente | disponível | disponível |
| `nitro` | pendente | disponível | disponível |
| `ops` | pendente | disponível | disponível |
| `photo` | pendente | disponível | disponível |
| `pin` | pendente | disponível | disponível |
| `right_arrow` | pendente | disponível | disponível |
| `Server_Boost` | pendente | disponível | disponível |
| `settings` | pendente | disponível | disponível |
| `share` | pendente | disponível | disponível |
| `ShareScreen` | pendente | disponível | disponível |
| `shield` | pendente | disponível | disponível |
| `Stackofbooks` | pendente | disponível | disponível |
| `Staff` | pendente | disponível | disponível |
| `StaffPing` | pendente | disponível | disponível |
| `star` | pendente | disponível | disponível |
| `sucess` | pendente | disponível | disponível |
| `trash` | pendente | disponível | disponível |
| `unlock` | pendente | disponível | disponível |
| `unmute` | pendente | disponível | disponível |
| `vault` | pendente | disponível | disponível |
| `verified` | pendente | disponível | disponível |

## Atualização pelo GrokBot

Após administrar os emojis, atualize este arquivo no GitHub: adicione ou remova entradas, descreva brevemente o uso e marque cada ambiente como `disponível` ou `ausente`. Registre a data da conferência. Use os nomes exatos dos emojis da aplicação KuruttinaBot de cada ambiente; preserve os nomes usados pelo código ou coordene sua alteração com os consumidores.

Documente somente metadados públicos em texto. Imagens continuam no armazenamento externo, conforme as [regras de assets](../agents/assets.md). Não é necessário publicar um JSON de catálogo no R2 nem manter IDs no código das mensagens.

## Uso pela IA de código

Leia esta tabela ao precisar de emojis. Escolha pelo nome, finalidade e disponibilidade no ambiente da tarefa. Se faltar informação, registre a pendência para o GrokBot e use uma alternativa Unicode adequada, sem iniciar uma busca externa de inventário.

Use o resolver existente para montar a mensagem:

```ts
const warning = await context.emoji('warning');
await context.reply(`${warning || '⚠️'} Confira os dados informados.`);
```

O [resolver](../../apps/bot/src/infrastructure/discord/commandContext.ts) obtém o emoji pelo nome na aplicação conectada durante a execução do bot. Ele já possui alternativas Unicode para `dancing`, `stats` e `gateway`; outros nomes ausentes retornam uma string vazia. O exemplo define a alternativa de `warning` na própria mensagem.
