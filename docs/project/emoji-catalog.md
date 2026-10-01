# Catálogo de emojis para agentes

O DevOps do GrokBot mantém este arquivo atualizado pelo GitHub. A IA de código consulta o catálogo diretamente no checkout do repositório para escolher emojis nas mensagens, sem pesquisar no R2 ou consultar o Discord para descobrir o inventário.

## Catálogo

A tabela lista todos os emojis das aplicações KuruttinaBot de Development e Production, com os nomes exatos do Discord. O resolver compara o nome diferenciando maiúsculas de minúsculas (use `API`, não `api`). As respostas atuais usam 24 desses nomes; os outros 39 ficam reservados para o contexto descrito e ainda não entram nas mensagens. `pendente` indica uso ainda não descrito ou disponibilidade não conferida.

Última conferência pelo GrokBot: Development 2026-09-30; Production 2026-09-30.

| Nome | Uso na mensagem | Development | Production |
| --- | --- | --- | --- |
| `dancing` | Resposta animada do ping | disponível | disponível |
| `stats` | Latência da API | disponível | disponível |
| `gateway` | Latência do Gateway | disponível | disponível |
| `warning` | Quantidade inválida, entrada rejeitada ou limite da importação | disponível | disponível |
| `loading` | Limpeza de mensagens já em andamento | disponível | disponível |
| `cleaning` | Confirmação da limpeza de mensagens | disponível | disponível |
| `slap` | Complemento da confirmação de limpeza; omitido quando indisponível | disponível | disponível |
| `error` | Falha ao buscar, apagar, importar ou erro inesperado no slash | disponível | disponível |
| `search` | Nenhuma mensagem encontrada ou emoji de origem ausente | disponível | disponível |
| `add` | Confirmação de que o emoji agora está neste servidor | disponível | disponível |
| `API` | Reação tímida ou carinhosa | disponível | disponível |
| `ban` | Banimento de membro | disponível | disponível |
| `book` | Orientação quando o comando exige um subcomando | disponível | disponível |
| `ChannelBrowser` | Comando usado fora de canal de texto de servidor | disponível | disponível |
| `coffee` | Bot ocupado ou fila de importação cheia | disponível | disponível |
| `crown` | Dono do servidor ou posição de destaque | disponível | disponível |
| `cry` | Tristeza ou lamento | disponível | disponível |
| `developer` | Confirmação de que o emoji agora está nos Application Emojis do bot de produção | disponível | disponível |
| `Dice` | Resultado aleatório ou sorteio | disponível | disponível |
| `DiceRooling` | Sorteio ou rolagem de dados em andamento | disponível | disponível |
| `Disappointed` | Membro sem a permissão exigida pelo comando | disponível | disponível |
| `Disgusted` | Reprovação ou desagrado | disponível | disponível |
| `Documentation` | Documentação ou referência | disponível | disponível |
| `folder` | Pasta, categoria ou arquivos | disponível | disponível |
| `guild` | Importação de emoji sem servidor de destino | disponível | disponível |
| `Heart` | Agradecimento ou carinho | disponível | disponível |
| `home` | Início ou menu principal | disponível | disponível |
| `ID` | Usuário inválido na limpeza | disponível | disponível |
| `info` | Informação ou detalhe complementar | disponível | disponível |
| `kick` | Expulsão de membro | disponível | disponível |
| `label` | Nome de emoji inválido | disponível | disponível |
| `left_arrow` | Voltar ou página anterior | disponível | disponível |
| `link` | Link ou convite | disponível | disponível |
| `lock` | Acesso restrito à equipe | disponível | disponível |
| `logs` | Registros ou auditoria | disponível | disponível |
| `moderation` | Moderação ou ação da staff | disponível | disponível |
| `mute` | Silenciamento de membro | disponível | disponível |
| `nitro` | Discord Nitro | disponível | disponível |
| `ops` | Falha ao consultar permissões, acesso da equipe, importação ou destino | disponível | disponível |
| `photo` | Imagem ausente, vazia ou em formato não suportado | disponível | disponível |
| `pin` | Mensagem fixada | disponível | disponível |
| `right_arrow` | Avançar ou próxima página | disponível | disponível |
| `Server_Boost` | Impulso do servidor | disponível | disponível |
| `settings` | Configurações | disponível | disponível |
| `share` | Compartilhamento ou encaminhamento | disponível | disponível |
| `ShareScreen` | Transmissão de tela | disponível | disponível |
| `shield` | URL de origem fora do CDN do Discord | disponível | disponível |
| `Stackofbooks` | Lista extensa, histórico ou coleção de conteúdos | disponível | disponível |
| `StaffPing` | Chamado ou menção à staff | disponível | disponível |
| `star` | Destaque ou favorito | disponível | disponível |
| `sucess` | Conclusão da importação de emoji, verificado ou confirmado | disponível | disponível |
| `trash` | Exclusão ou remoção | disponível | disponível |
| `unlock` | Desbloqueio ou acesso liberado | disponível | disponível |
| `unmute` | Fim do silenciamento de membro | disponível | disponível |
| `vault` | Cofre, armazenamento ou backup | disponível | disponível |
| `Angry` | Bot sem as permissões necessárias no canal | disponível | disponível |
| `Note` | Anotação, lembrete ou registro | disponível | disponível |
| `ping` | Latência, conexão ou comando de ping | disponível | disponível |
| `question` | Dúvida, pergunta ou ajuda | disponível | disponível |
| `scared` | Susto, medo ou alerta assustador | disponível | disponível |
| `SpinningDancing` | Comemoração ou animação de dança | disponível | disponível |
| `staff` | Equipe ou cargo da staff | disponível | disponível |
| `affiliate` | Afiliados, parcerias ou vantagem premium | disponível | disponível |

## Atualização pelo GrokBot

Após administrar os emojis, atualize este arquivo no GitHub: adicione ou remova entradas, descreva brevemente o uso e marque cada ambiente como `disponível` ou `ausente`. Registre a data da conferência. Use os nomes exatos dos emojis da aplicação KuruttinaBot de cada ambiente; preserve os nomes usados pelo código ou coordene sua alteração com os consumidores.

Documente somente metadados públicos em texto. Imagens continuam no armazenamento externo, conforme as [regras de assets](../agents/assets.md). Não é necessário publicar um JSON de catálogo no R2 nem manter IDs no código das mensagens.

## Uso pela IA de código

Leia esta tabela ao precisar de emojis. Escolha pelo nome, finalidade e disponibilidade no ambiente da tarefa. Se faltar informação, registre a pendência para o GrokBot e use o resolver, sem iniciar uma busca externa de inventário.

Use `context.emoji()` e `withEmojis()` para montar a mensagem. O [resolver](../../apps/bot/src/infrastructure/discord/commandContext.ts) consulta a aplicação uma vez por execução e, se o emoji personalizado estiver ausente ou a consulta falhar, devolve a alternativa Unicode abaixo:

```ts
const warning = await context.emoji('warning');
await context.reply(withEmojis(warning, 'Confira os dados informados.'));
```

Toda mensagem dirigida ao usuário precisa de pelo menos um nome desta tabela de alternativas. O resolver devolve esse Unicode quando o emoji personalizado está ausente ou a consulta falha, e a resposta não sai sem emoji. Emojis complementares podem ficar de fora: `slap` não tem alternativa Unicode e some da confirmação de limpeza quando indisponível, sem retirar `cleaning`. `withEmojis()` omite partes vazias, então não sobra espaço quando um emoji não pode ser exibido. Nomes fora da tabela de alternativas, inclusive grafia diferente da coluna Nome, retornam uma string vazia. Preserve `sucess`, `DiceRooling` e `API`, inclusive a capitalização.

| Emojis | Alternativas |
| --- | --- |
| `dancing`, `stats`, `gateway` | 💃, 📊, 🌐 |
| `warning`, `loading`, `cleaning` | ⚠️, ⏳, 🧹 |
| `error`, `search`, `add`, `sucess` | ❌, 🔎, ➕, ✅ |
| `Angry`, `Disappointed`, `ops` | 😠, 😞, 😅 |
| `ChannelBrowser`, `guild`, `ID` | 🏘️, 🏘️, 🪪 |
| `developer`, `lock`, `book`, `coffee` | 🧑‍💻, 🔒, 📖, ☕ |
| `photo`, `label`, `shield` | 🖼️, 🏷️, 🛡️ |
