# Catálogo de emojis para agentes

O DevOps do GrokBot mantém este arquivo atualizado pelo GitHub. A IA de código consulta o catálogo diretamente no checkout do repositório para escolher emojis nas mensagens, sem pesquisar no R2 ou consultar o Discord para descobrir o inventário.

## Catálogo

A tabela lista todos os emojis das aplicações KuruttinaBot de Development e Production, com os nomes exatos do Discord. O resolver compara o nome diferenciando maiúsculas de minúsculas (use `API`, não `api`). Só parte desses nomes é referenciada pelo código hoje. `pendente` indica uso ainda não descrito ou disponibilidade não conferida.

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
| `add` | Adição ou criação de item | disponível | disponível |
| `AFFILIATE` | Afiliados, parcerias ou vantagem premium | disponível | disponível |
| `Anger` | Bot sem as permissões necessárias no canal | disponível | disponível |
| `API` | Reação tímida ou carinhosa | disponível | disponível |
| `ban` | Banimento de membro | disponível | disponível |
| `book` | Guia, tutorial ou regras | disponível | disponível |
| `ChannelBrowser` | Comando usado fora de canal de texto de servidor | disponível | disponível |
| `coffee` | Pausa, espera tranquila ou momento descontraído | disponível | disponível |
| `crown` | Dono do servidor ou posição de destaque | disponível | disponível |
| `cry` | Tristeza ou lamento | disponível | disponível |
| `developer` | Desenvolvimento ou recurso da equipe de dev | disponível | disponível |
| `Dice` | Resultado aleatório ou sorteio | disponível | disponível |
| `DiceRooling` | Sorteio ou rolagem de dados em andamento | disponível | disponível |
| `Disappointed` | Membro sem a permissão exigida pelo comando | disponível | disponível |
| `Disgusted` | Reprovação ou desagrado | disponível | disponível |
| `Documentation` | Documentação ou referência | disponível | disponível |
| `folder` | Pasta, categoria ou arquivos | disponível | disponível |
| `guild` | Servidor ou informações da guilda | disponível | disponível |
| `Heart` | Agradecimento ou carinho | disponível | disponível |
| `home` | Início ou menu principal | disponível | disponível |
| `ID` | Identificação ou ID de usuário | disponível | disponível |
| `info` | Informação ou detalhe complementar | disponível | disponível |
| `kick` | Expulsão de membro | disponível | disponível |
| `label` | Etiqueta, tag ou categoria | disponível | disponível |
| `left_arrow` | Voltar ou página anterior | disponível | disponível |
| `link` | Link ou convite | disponível | disponível |
| `lock` | Bloqueio ou acesso restrito | disponível | disponível |
| `logs` | Registros ou auditoria | disponível | disponível |
| `moderation` | Moderação ou ação da staff | disponível | disponível |
| `mute` | Silenciamento de membro | disponível | disponível |
| `nitro` | Discord Nitro | disponível | disponível |
| `ops` | Falha ao conferir permissões do membro ou do bot | disponível | disponível |
| `photo` | Imagem, foto ou avatar | disponível | disponível |
| `pin` | Mensagem fixada | disponível | disponível |
| `right_arrow` | Avançar ou próxima página | disponível | disponível |
| `Server_Boost` | Impulso do servidor | disponível | disponível |
| `settings` | Configurações | disponível | disponível |
| `share` | Compartilhamento ou encaminhamento | disponível | disponível |
| `ShareScreen` | Transmissão de tela | disponível | disponível |
| `shield` | Proteção ou segurança | disponível | disponível |
| `Stackofbooks` | Lista extensa, histórico ou coleção de conteúdos | disponível | disponível |
| `Staff` | Equipe ou cargo da staff | disponível | disponível |
| `StaffPing` | Chamado ou menção à staff | disponível | disponível |
| `star` | Destaque ou favorito | disponível | disponível |
| `sucess` | Operação concluída com sucesso | disponível | disponível |
| `trash` | Exclusão ou remoção | disponível | disponível |
| `unlock` | Desbloqueio ou acesso liberado | disponível | disponível |
| `unmute` | Fim do silenciamento de membro | disponível | disponível |
| `vault` | Cofre, armazenamento ou backup | disponível | disponível |
| `verified` | Verificado ou confirmado | ausente | ausente |

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
