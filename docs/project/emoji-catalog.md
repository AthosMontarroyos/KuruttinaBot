@ -4,7 +4,7 @@ O DevOps do GrokBot mantém este arquivo atualizado pelo GitHub. A IA de código

## Catálogo

A tabela lista todos os emojis das aplicações KuruttinaBot de Development e Production, com os nomes exatos do Discord. O resolver compara o nome diferenciando maiúsculas de minúsculas (use `API`, não `api`). Só parte desses nomes é referenciada pelo código hoje. `pendente` indica uso ainda não descrito ou disponibilidade não conferida.
A tabela lista todos os emojis das aplicações KuruttinaBot de Development e Production, com os nomes exatos do Discord. O resolver compara o nome diferenciando maiúsculas de minúsculas (use `API`, não `api`). As respostas atuais usam 24 desses nomes; os outros 35 ficam reservados para o contexto descrito e ainda não entram nas mensagens. `pendente` indica uso ainda não descrito ou disponibilidade não conferida.

Última conferência pelo GrokBot: Development 2026-09-28; Production 2026-09-28.

@ -13,57 +13,57 @@ A tabela lista todos os emojis das aplicações KuruttinaBot de Development e Pr
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
| `warning` | Quantidade inválida, entrada rejeitada ou limite da importação | disponível | disponível |
| `loading` | Limpeza de mensagens já em andamento | disponível | disponível |
| `cleaning` | Confirmação da limpeza de mensagens | disponível | disponível |
| `slap` | Complemento da confirmação de limpeza; omitido quando indisponível | disponível | disponível |
| `error` | Falha ao buscar, apagar, importar ou erro inesperado no slash | disponível | disponível |
| `search` | Nenhuma mensagem encontrada ou emoji de origem ausente | disponível | disponível |
| `add` | Emoji adicionado a este servidor | disponível | disponível |
| `AFFILIATE` | Afiliados, parcerias ou vantagem premium | disponível | disponível |
| `Anger` | Bot sem as permissões necessárias no canal | disponível | disponível |
| `API` | Reação tímida ou carinhosa | disponível | disponível |
| `ban` | Banimento de membro | disponível | disponível |
| `book` | Guia, tutorial ou regras | disponível | disponível |
| `book` | Orientação quando o comando exige um subcomando | disponível | disponível |
| `ChannelBrowser` | Comando usado fora de canal de texto de servidor | disponível | disponível |
| `coffee` | Pausa, espera tranquila ou momento descontraído | disponível | disponível |
| `coffee` | Bot ocupado ou fila de importação cheia | disponível | disponível |
| `crown` | Dono do servidor ou posição de destaque | disponível | disponível |
| `cry` | Tristeza ou lamento | disponível | disponível |
| `developer` | Desenvolvimento ou recurso da equipe de dev | disponível | disponível |
| `developer` | Emoji adicionado aos Application Emojis do bot | disponível | disponível |
| `Dice` | Resultado aleatório ou sorteio | disponível | disponível |
| `DiceRooling` | Sorteio ou rolagem de dados em andamento | disponível | disponível |
| `Disappointed` | Membro sem a permissão exigida pelo comando | disponível | disponível |
| `Disgusted` | Reprovação ou desagrado | disponível | disponível |
| `Documentation` | Documentação ou referência | disponível | disponível |
| `folder` | Pasta, categoria ou arquivos | disponível | disponível |
| `guild` | Servidor ou informações da guilda | disponível | disponível |
| `guild` | Importação de emoji sem servidor de destino | disponível | disponível |
| `Heart` | Agradecimento ou carinho | disponível | disponível |
| `home` | Início ou menu principal | disponível | disponível |
| `ID` | Identificação ou ID de usuário | disponível | disponível |
| `ID` | Usuário inválido na limpeza | disponível | disponível |
| `info` | Informação ou detalhe complementar | disponível | disponível |
| `kick` | Expulsão de membro | disponível | disponível |
| `label` | Etiqueta, tag ou categoria | disponível | disponível |
| `label` | Nome de emoji inválido | disponível | disponível |
| `left_arrow` | Voltar ou página anterior | disponível | disponível |
| `link` | Link ou convite | disponível | disponível |
| `lock` | Bloqueio ou acesso restrito | disponível | disponível |
| `lock` | Acesso restrito à equipe | disponível | disponível |
| `logs` | Registros ou auditoria | disponível | disponível |
| `moderation` | Moderação ou ação da staff | disponível | disponível |
| `mute` | Silenciamento de membro | disponível | disponível |
| `nitro` | Discord Nitro | disponível | disponível |
| `ops` | Falha ao conferir permissões do membro ou do bot | disponível | disponível |
| `photo` | Imagem, foto ou avatar | disponível | disponível |
| `ops` | Falha ao consultar permissões, acesso da equipe, importação ou destino | disponível | disponível |
| `photo` | Imagem ausente, vazia ou em formato não suportado | disponível | disponível |
| `pin` | Mensagem fixada | disponível | disponível |
| `right_arrow` | Avançar ou próxima página | disponível | disponível |
| `Server_Boost` | Impulso do servidor | disponível | disponível |
| `settings` | Configurações | disponível | disponível |
| `share` | Compartilhamento ou encaminhamento | disponível | disponível |
| `ShareScreen` | Transmissão de tela | disponível | disponível |
| `shield` | Proteção ou segurança | disponível | disponível |
| `shield` | URL de origem fora do CDN do Discord | disponível | disponível |
| `Stackofbooks` | Lista extensa, histórico ou coleção de conteúdos | disponível | disponível |
| `Staff` | Equipe ou cargo da staff | disponível | disponível |
| `StaffPing` | Chamado ou menção à staff | disponível | disponível |
| `star` | Destaque ou favorito | disponível | disponível |
| `sucess` | Operação concluída com sucesso | disponível | disponível |
| `trash` | Exclusão ou remoção | disponível | disponível |
| `unlock` | Desbloqueio ou acesso liberado | disponível | disponível |
| `unmute` | Fim do silenciamento de membro | disponível | disponível |
@ -78,13 +78,23 @@ Documente somente metadados públicos em texto. Imagens continuam no armazenamen

## Uso pela IA de código

Leia esta tabela ao precisar de emojis. Escolha pelo nome, finalidade e disponibilidade no ambiente da tarefa. Se faltar informação, registre a pendência para o GrokBot e use uma alternativa Unicode adequada, sem iniciar uma busca externa de inventário.
Leia esta tabela ao precisar de emojis. Escolha pelo nome, finalidade e disponibilidade no ambiente da tarefa. Se faltar informação, registre a pendência para o GrokBot e use o resolver, sem iniciar uma busca externa de inventário.

Use o resolver existente para montar a mensagem:
Use `context.emoji()` e `withEmojis()` para montar a mensagem. O [resolver](../../apps/bot/src/infrastructure/discord/commandContext.ts) consulta a aplicação uma vez por execução e, se o emoji personalizado estiver ausente ou a consulta falhar, devolve a alternativa Unicode abaixo:

```ts
const warning = await context.emoji('warning');
await context.reply(`${warning || '⚠️'} Confira os dados informados.`);
await context.reply(withEmojis(warning, 'Confira os dados informados.'));
```

O [resolver](../../apps/bot/src/infrastructure/discord/commandContext.ts) obtém o emoji pelo nome na aplicação conectada durante a execução do bot. Ele já possui alternativas Unicode para `dancing`, `stats` e `gateway`; outros nomes ausentes retornam uma string vazia. O exemplo define a alternativa de `warning` na própria mensagem.
`withEmojis()` omite partes vazias, então não sobra espaço quando um emoji não pode ser exibido. `slap` não tem alternativa Unicode e some da confirmação de limpeza quando indisponível. Nomes fora da tabela de alternativas, inclusive grafia diferente da coluna Nome, retornam uma string vazia. Preserve `sucess`, `DiceRooling` e `API`, inclusive a capitalização.

| Emojis | Alternativas |
| --- | --- |
| `dancing`, `stats`, `gateway` | 💃, 📊, 🌐 |
| `warning`, `loading`, `cleaning` | ⚠️, ⏳, 🧹 |
| `error`, `search`, `add`, `sucess` | ❌, 🔎, ➕, ✅ |
| `Anger`, `Disappointed`, `ops` | 😠, 😞, 😅 |
| `ChannelBrowser`, `guild`, `ID` | 🏘️, 🏘️, 🪪 |
| `developer`, `lock`, `book`, `coffee` | 🧑‍💻, 🔒, 📖, ☕ |
| `photo`, `label`, `shield` | 🖼️, 🏷️, 🛡️ |