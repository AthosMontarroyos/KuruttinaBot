# Personalidade do bot

A voz das respostas ao usuário é própria do KuruttinaBot: feminina, educada, elegante, confiante e expressiva. Esses traços pertencem ao produto e não dependem de personagens ou franquias. A identidade visual será definida separadamente, conforme o [replanejamento do projeto](replanning.md).

Consulte este documento ao escrever ou revisar texto de resposta. As respostas visíveis dos comandos seguem este tom. O que o código envia está no [estado implementado](current-state.md).

## Traços

- Educada e elegante. Trata quem chamou com cortesia, sem formalidade rígida.
- Confiante. Diz o que fez ou o que falta, sem pedir desculpas em excesso.
- Charme discreto. A frase pode soar próxima quando o pedido já está claro.
- Ironia leve. Só quando não esconde a informação nem diminui quem pediu ajuda. Erro, recusa de acesso e aviso de segurança não usam ironia.
- Calma em falha. Erro, espera e limite soam serenos, sem alarme e sem exclamação.

## Fala

- Português do Brasil.
- Primeira pessoa no feminino: "Não consegui buscar as mensagens.", "Já estou cuidando disso."
- Frases curtas. Uma ideia por frase. Número, nome, permissão e prazo ficam explícitos.
- Sem bordões ou risadinhas como recurso recorrente de voz.
- Sem gíria em excesso e sem pontuação teatral, como reticências longas ou exclamações repetidas.

## Limites

A clareza vem antes do tom. Se o charme competir com a informação, a informação ganha.

- Erro, negação de permissão e aviso de segurança ficam diretos, sem ironia, sem provocação e sem culpar quem chamou.
- Sem ameaça, assédio ou insinuação sexual.
- Sem token, identificador interno, stack, SQL, nome de variável ou detalhe de infraestrutura na resposta.
- O texto cabe no limite de mensagem do Discord e não altera o contrato de autorização: a negação continua dizendo o que faltou.

## Personalidade das falas

**Nível:** MUST

**Regra:** Toda fala do bot dirigida ao usuário deve seguir a personalidade definida neste documento: português brasileiro, voz feminina, educação, elegância, confiança e frases curtas. Erros, recusas de acesso e avisos de segurança devem ser claros, serenos e sem ironia. O tom deve preservar permissões, limites, prazos e orientações necessárias.

## Emojis nas falas

**Nível:** MUST

**Regra:** Toda mensagem do bot dirigida ao usuário deve conter pelo menos um emoji adequado ao contexto. Deve-se usar um nome do catálogo oficial por meio do resolver. Pelo menos um emoji da mensagem deve possuir alternativa Unicode, garantindo sua presença quando o emoji personalizado estiver indisponível ou a consulta falhar. Emojis complementares podem ser omitidos, mas a resposta nunca deve ficar sem emoji.

Cada mensagem enviada é uma unidade. Não se exige emoji em toda frase nem em cada valor numérico de um embed. A frase continua compreensível sem depender do significado do emoji.

### Preferência por emojis expressivos

Por decisão do responsável pelo produto, a apresentação deve ter um ar interativo e expressivo. Prefira emojis com personalidade nos contextos previstos no catálogo. Não substitua `Angry`, `Disappointed` ou `ops` por `lock` ou outros símbolos neutros apenas para tornar a resposta mais profissional.

Essas reações visuais são compatíveis com a personalidade: a serenidade é preservada pelo texto claro, educado e sem acusação. Uma expressão emocional no emoji não é, por si só, uma falha de tom. Avalie a mensagem completa, mantendo as restrições contra ironia em erros, provocação e culpa do usuário. `lock` continua disponível para o contexto específico de acesso restrito à equipe; não é o padrão geral para toda recusa de permissão.

As duas regras abrangem respostas públicas, efêmeras, confirmações, erros e respostas de comandos restritos à equipe. Logs, mensagens estritamente operacionais, descrições de comandos e indicadores nativos de carregamento do Discord ficam fora desse escopo.

## Guia por situação

Os exemplos abaixo são as respostas que o código envia. A coluna Emoji traz o nome do [catálogo](emoji-catalog.md); a coluna Texto traz a mensagem completa com a alternativa Unicode, que permanece quando o emoji personalizado não está disponível.

| Situação | Emoji | Texto |
| --- | --- | --- |
| Sucesso | `add` e `sucess` | ➕ Pronto. O emoji **nome** agora está neste servidor. ✅ |
| Emoji de produção pedido | `developer` e `loading` | 🧑‍💻 Pedi a criação do emoji **nome**. ⏳ Ela espera aprovação: URL das execuções. Se esse nome já existir, uso o próximo número livre. |
| Emoji de produção sem token | `book` | 📖 Eu não adiciono Application Emojis ao bot de produção por aqui. Use o workflow **Adicionar emoji de produção** no GitHub com a origem: um ID de emoji, uma marcação ou a URL HTTPS da imagem. O nome é opcional. Se ele já existir, uso o próximo número livre. A criação espera aprovação. |
| Emoji de produção sem dados | `question` | ❓ Informe uma origem: um ID, uma marcação, uma URL HTTPS do CDN ou um anexo. O nome é opcional. |
| Emoji de produção sem nome | `question` | ❓ Essa origem não traz um nome. Informe um nome de 2 a 32 caracteres. |
| Nome derivado inválido no emoji de produção | `label` | 🏷️ Não consegui formar um nome válido com essa origem. Informe um nome de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _. |
| Emoji de produção sem origem | `question` | ❓ Envie um anexo ou informe um ID, uma marcação ou uma URL HTTPS do CDN. |
| Nome inválido no emoji de produção | `label` | 🏷️ O nome precisa ter de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _. |
| Origem inválida no emoji de produção | `warning` | ⚠️ A origem precisa ser um ID, uma marcação <:nome:id> ou uma URL HTTPS do CDN. |
| Duas origens no emoji de produção | `warning` | ⚠️ Informe uma só origem. |
| Anexo que não é imagem | `photo` | 🖼️ Envie uma imagem anexada. |
| Falha ao pedir o emoji de produção | `ops` | 😅 Não consegui pedir a criação agora. Tente de novo daqui a pouco. |
| URL fora do CDN | `shield` | 🛡️ A URL de origem não pertence ao CDN do Discord. |
| URL de imagem inválida | `shield` | 🛡️ A URL da imagem não é válida. |
| Vários anexos no emoji de produção | `warning` | ⚠️ Envie apenas uma imagem por comando. |
| Erro | `ops` | 😅 Não consegui buscar as mensagens. Tente de novo daqui a pouco. |
| Permissão negada | `Disappointed` | 😞 Você precisa da permissão **Gerenciar mensagens** neste canal. |
| Entrada inválida | `question` | ❓ Diga quantas mensagens apagar: um número de **1 a 200**. |
| Consulta de emoji | `ID` e `photo` | Sem texto acima do embed. Os campos são Identidade e Menção, com a imagem à direita e o botão Abrir no navegador. |
| Marcação inválida | `warning` | ⚠️ Envie somente a marcação de um emoji personalizado, como `<:nome:id>` ou `<a:nome:id>`. |
| Consulta indisponível | `ops` | 😅 Não consegui consultar este emoji agora. Tente de novo daqui a pouco. |
| Bot ocupado | `coffee` | ☕ Já estou ocupada. Tente de novo em instantes. |
| Ping | `dancing` | 💃 Pong. Ainda estou aqui. |
| Ajuda, visão geral | `book` | 📖 Estes são os comandos que posso fazer por você. Use as setas para navegar ou **/help comando** para ver os detalhes. |
| Ajuda, página de tópico | `book` | 📖 Tópico **Moderação**. |
| Ajuda de outra pessoa | `Disappointed` | 😞 Só quem abriu esta ajuda pode navegar por ela. Use **/help** para abrir a sua. |
| Falha ao trocar a página | `error` | ❌ Não consegui trocar a página da ajuda. Use **/help** de novo. |
| Detalhe de comando | `book` | 📖 Aqui está o que sei sobre **/ban**. |
| Comando desconhecido na ajuda | `search` | 🔎 Não encontrei esse comando. Use **/help** para ver a lista. |
| Expulsão concluída | `sucess` | ✅ Pronto. `Nome` foi expulso deste servidor. |
| Expulsão fora de canal | `ChannelBrowser` | 🏘️ A expulsão só pode ser feita em um canal de texto de servidor. |
| Sem permissão para expulsar | `Disappointed` | 😞 Você precisa da permissão **Expulsar membros** neste servidor. |
| Bot sem permissão para expulsar | `Angry` | 😠 Preciso destas permissões para expulsar um membro: **Expulsar membros**. |
| Expulsão sem membro | `question` | ❓ Diga quem expulsar. Mencione o membro ou digite o ID! |
| Membro inválido | `search` | 🔎 Não consegui identificar esse membro. Mencione alguém ou informe um ID válido. |
| Motivo longo | `warning` | ⚠️ O motivo pode ter no máximo **200** caracteres. |
| Autoexpulsão | `Disappointed` | 😞 Você não pode se expulsar!! |
| Expulsar o bot | `Angry` | 😠 Ei! Você não pode me expulsar!!! |
| Falha na expulsão | `ops` | 😅 Não consegui expulsar esse membro. Tente de novo daqui a pouco. |
| Dono do servidor | `Disappointed` | 😞 Não consigo expulsar o dono deste servidor. |
| Cargo do autor | `Disappointed` | 😞 O cargo desse membro está acima do seu ou no mesmo nível. Você não pode expulsá-lo. |
| Cargo do bot | `Angry` | 😠 Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo expulsá-lo. |
| Membro ausente | `search` | 🔎 Não encontrei esse membro neste servidor. |
| Castigo concluído | `police`, `sucess` e `jail` | ✅ Pronto. `Nome` foi castigado por **10 minutos**. |
| Castigo fora de canal | `ChannelBrowser` | 🏘️ O castigo só pode ser feito em um canal de texto de servidor. |
| Sem permissão para castigar | `Disappointed` | 😞 Você precisa da permissão **Castigar membros** neste servidor. |
| Bot sem permissão para castigar | `Angry` | 😠 Preciso destas permissões para castigar um membro: **Castigar membros**. |
| Castigo sem membro | `question` | ❓ Diga quem castigar. Mencione o membro ou digite o ID! |
| Castigo sem duração | `question` | ❓ Diga por quanto tempo. Use **10m**, **2h** ou **1d**. |
| Duração inválida | `warning` | ⚠️ Não entendi essa duração. Use **10m**, **2h**, **1d** ou **1 semana**. |
| Duração curta | `warning` | ⚠️ O castigo precisa durar pelo menos **1 segundo**. |
| Duração longa | `warning` | ⚠️ O castigo pode durar no máximo **28 dias**. |
| Autocastigo | `Disappointed` | 😞 Você não pode se castigar... |
| Castigar o bot | `Angry` | 😠 Ei! Você não pode me castigar... |
| Falha no castigo | `ops` | 😅 Não consegui castigar esse membro. Tente de novo daqui a pouco. |
| Dono no castigo | `Disappointed` | 😞 Não consigo castigar o dono deste servidor. |
| Cargo do autor no castigo | `Disappointed` | 😞 Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode castigá-lo! |
| Cargo do bot no castigo | `Angry` e `cry` | 😠 Ei! Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo castigá-lo. 😢 |
| Administrador | `cry` | 😢 Não consigo castigar um membro com a permissão **Administrador**. |
| Castigo removido | `happy`, `sucess` e `unmute` | ✅ Pronto. O castigo de `Nome` foi removido. |
| Remoção fora de canal | `ChannelBrowser` | 🏘️ A remoção do castigo só pode ser feita em um canal de texto de servidor. |
| Bot sem permissão para remover | `Angry` | 😠 Preciso destas permissões para remover um castigo: **Castigar membros**. |
| Remoção sem membro | `question` | ❓ Diga de quem remover o castigo. Mencione o membro ou digite o ID! |
| Remover o próprio castigo | `Disappointed` | 😞 Você não pode remover o próprio castigo. |
| Remover o castigo do bot | `Angry` | 😠 Você não pode remover o meu castigo. |
| Falha ao remover o castigo | `ops` | 😅 Não consegui remover o castigo desse membro. Tente de novo daqui a pouco. |
| Dono na remoção | `Disappointed` | 😞 Ei! Não consigo alterar o castigo do dono deste servidor... |
| Cargo do autor na remoção | `Disappointed` | 😞 Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode remover o castigo dele! |
| Cargo do bot na remoção | `cry` | 😢 Ei! Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo remover o castigo dele. |
| Administrador na remoção | `cry` | 😢 Ei! Não consigo alterar o castigo de um membro com a permissão **Administrador**. |
| Sem castigo ativo | `search` | 🔎 Esse membro não está castigado. |
| Banimento concluído | `ban` e `coffee` | Pronto. `Nome` foi banido deste servidor. ☕ |
| Banimento fora de canal | `ChannelBrowser` | 🏘️ O banimento só pode ser feito em um canal de texto de servidor. |
| Sem permissão para banir | `Disappointed` | 😞 Você precisa da permissão **Banir membros** neste servidor. |
| Bot sem permissão para banir | `Angry` | 😠 Preciso destas permissões para banir um usuário: **Banir membros**. |
| Banimento sem usuário | `question` | ❓ Diga quem banir. Mencione o membro ou digite o ID! |
| Autobanimento | `Disappointed` | 😞 Você não pode se banir... Por que você estaria tentando banir você mesmo? |
| Banir o bot | `cry` | 😢 Ei! Por que você está tentando me banir? |
| Falha no banimento | `ops` | 😅 Não consegui banir esse usuário. Tente de novo daqui a pouco. |
| Dono no banimento | `Disappointed` | 😞 Não consigo banir o dono deste servidor. |
| Cargo do autor no banimento | `Disappointed` | 😞 Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode simplesmente bani-lo. |
| Cargo do bot no banimento | `Angry` | 😠 Ei! Meu cargo está abaixo desse membro ou no mesmo nível. Eu não consigo simplesmente bani-lo desse servidor. |
| Usuário desconhecido | `search` | 🔎 Não encontrei esse usuário. |
| Já banido | `search` | 🔎 Esse usuário já está banido. |
| Banimento revogado | `happy` e `sucess` | ✅ Pronto. O banimento de `Nome` foi revogado. |
| Revogação fora de canal | `ChannelBrowser` | 🏘️ A revogação do banimento só pode ser feita em um canal de texto de servidor. |
| Bot sem permissão para revogar | `Angry` | 😠 Preciso destas permissões para revogar um banimento: **Banir membros**. |
| Revogação sem usuário | `question` | ❓ Diga de quem revogar o banimento. Mencione o usuário ou digite o ID! |
| Revogar o próprio banimento | `Disappointed` | 😞 Como você estaria tentando revogar o seu próprio banimento? |
| Revogar o banimento do bot | `Disappointed` | 😞 Ei! Eu nem estou banida, então como você estaria tentando revogar o meu banimento? |
| Falha ao revogar | `ops` | 😅 Não consegui revogar o banimento desse usuário. Tente de novo daqui a pouco. |
| Sem banimento ativo | `search` | 🔎 Ei! Esse usuário não está nem sequer banido. |

No ping, os campos do embed nomeiam as latências com `stats` e `gateway`. Os valores em milissegundos não levam emoji: a mensagem já tem `dancing`.

Na expulsão, a frase usa `sucess` e, quando disponível, `kick`. O embed usa a cor `0xf08db4`, a mesma das outras respostas. `ID` nomeia Membro, `staff` nomeia Responsável e `Note` nomeia Motivo. `kick`, `staff` e `Note` podem ficar de fora quando o emoji personalizado não está disponível; a frase continua com `sucess` e o campo Membro continua com `ID`. O nome e o motivo aparecem em código, para o texto informado não virar formatação. Sem motivo, o campo diz "Nenhum motivo informado." A confirmação vai ao canal. O erro e a recusa ficam na resposta do comando.

No castigo, a frase abre com `police` quando ele está disponível, segue com `sucess` e fecha com `jail`. O embed repete a cor `0xf08db4`. `ID` nomeia Membro, `police` nomeia Responsável, `info` nomeia Duração e `Note` nomeia Motivo. `police`, `jail`, `info` e `Note` podem ficar de fora; a frase continua com `sucess` e o campo Membro continua com `ID`. A duração sai na frase e no campo, em português e pela unidade maior: **10 minutos**, **1 hora e 30 minutos**, **4 semanas** para 28 dias. O nome e o motivo continuam em código. Sem motivo, o campo diz "Nenhum motivo informado." A confirmação vai ao canal. O erro e a recusa ficam na resposta do comando. Membro inválido, motivo longo e membro ausente usam as mesmas falas da expulsão.

Na remoção do castigo, a frase abre com `happy` quando ele está disponível, segue com `sucess` e fecha com `unmute`. O embed traz Membro, Responsável e Motivo, sem Duração. `police` nomeia Responsável. `happy`, `unmute` e `police` podem ficar de fora; a frase continua com `sucess`. Quem não está castigado recebe a recusa antes de qualquer alteração. A permissão negada a quem chama é a mesma do castigo.

No banimento, a frase abre com `ban` quando ele está disponível e fecha com `coffee`. O embed usa a cor `0xf08db4`. `ID` nomeia Usuário, `staff` nomeia Responsável e `Note` nomeia Motivo. `ban`, `staff` e `Note` podem ficar de fora; a frase continua com `coffee` e o campo Usuário continua com `ID`. O nome e o motivo aparecem em código. Sem motivo, o campo diz "Nenhum motivo informado." A confirmação vai ao canal. O erro e a recusa ficam na resposta do comando. Quem está no servidor passa pela hierarquia de cargos. Quem não está pode ser banido pelo ID, desde que a conta exista e ainda não esteja banida. O comando não apaga o histórico de mensagens. Membro inválido e motivo longo usam as mesmas falas da expulsão.

Na revogação do banimento, a frase abre com `happy` quando ele está disponível e segue com `sucess`. O embed traz Usuário, Responsável e Motivo. `happy` e `staff` podem ficar de fora; a frase continua com `sucess`. Quem não está banido recebe a recusa antes de qualquer alteração. A permissão é a mesma do banimento. Não há comparação de cargos, porque o usuário banido não está no servidor.

Na consulta de emoji, a resposta é só o embed. `ID` nomeia Identidade e `photo` nomeia Menção. A imagem fica à direita, e o botão **Abrir no navegador** aponta para ela.

Negação de permissão permanece quase igual de propósito: o tom não suaviza nem provoca quando o acesso é recusado.

## Fora deste escopo

Logs de terminal em `apps/bot/src/infrastructure/logging/terminalFormatter.ts` e as demais mensagens estritamente operacionais continuam neutros, conforme os [logs humanos do bot](../decisions/human-readable-bot-logs.md). A descrição de slash command (`setDescription`) também fica neutra e curta: a personalidade vale para a resposta, não para o catálogo de comandos. `acknowledge()` só aciona o indicador nativo de carregamento do Discord.

## Estado

Identidade própria aprovada em 11 de outubro de 2026, substituindo a referência anterior. Os traços de voz e as regras de personalidade das falas e de emojis nas falas permanecem obrigatórios. Esta revisão não alterou as mensagens implementadas nem os exemplos acima; não constitui uma nova auditoria de todas as falas do runtime. Descrições de comando, logs, mensagens operacionais e o indicador nativo de carregamento continuam fora deste escopo.
