# Catálogo de emojis para agentes

O DevOps do GrokBot mantém este arquivo atualizado pelo GitHub. A IA de código consulta o catálogo diretamente no checkout do repositório para escolher emojis nas mensagens, sem pesquisar no R2 ou consultar o Discord para descobrir o inventário.

## Catálogo

Os nomes abaixo já são referenciados pelo código. A disponibilidade nas aplicações Discord ainda precisa ser documentada pelo GrokBot; `pendente` não significa disponível nem ausente.

Última conferência pelo GrokBot: pendente.

| Nome | Uso na mensagem | Development | Production |
| --- | --- | --- | --- |
| `dancing` | Resposta animada do ping | pendente | pendente |
| `stats` | Latência da API | pendente | pendente |
| `gateway` | Latência do Gateway | pendente | pendente |
| `warning` | Aviso ou entrada inválida | pendente | pendente |
| `loading` | Operação em andamento | pendente | pendente |
| `cleaning` | Limpeza de mensagens | pendente | pendente |
| `slap` | Complemento expressivo da confirmação de limpeza | pendente | pendente |
| `error` | Falha na operação | pendente | pendente |
| `search` | Busca sem resultados | pendente | pendente |

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
