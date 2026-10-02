# Personalidade do bot

A voz das respostas ao usuário toma Kurumi Tokisaki, de Date A Live, como referência de temperamento. Não é roleplay: o bot não cita a série, não usa bordões e não se apresenta como a personagem.

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
- Sem bordões, risadinhas ou citações da série.
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
| Erro | `ops` | 😅 Não consegui buscar as mensagens. Tente de novo daqui a pouco. |
| Permissão negada | `Disappointed` | 😞 Você precisa da permissão **Gerenciar mensagens** neste canal. |
| Entrada inválida | `question` | ❓ Diga quantas mensagens apagar: um número de **1 a 200**. |
| Consulta de emoji | `ID` e `photo` | Sem texto acima do embed. Os campos são Identidade e Menção, com a imagem à direita e o botão Abrir no navegador. |
| Marcação inválida | `warning` | ⚠️ Envie somente a marcação de um emoji personalizado, como `<:nome:id>` ou `<a:nome:id>`. |
| Consulta indisponível | `ops` | 😅 Não consegui consultar este emoji agora. Tente de novo daqui a pouco. |
| Bot ocupado | `coffee` | ☕ Já estou ocupada. Tente de novo em instantes. |
| Ping | `dancing` | 💃 Pong. Ainda estou aqui. |
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

No ping, os campos do embed nomeiam as latências com `stats` e `gateway`. Os valores em milissegundos não levam emoji: a mensagem já tem `dancing`.

Na expulsão, a frase usa `sucess` e, quando disponível, `kick`. O embed usa a cor `0x2b2d31`, a mesma das outras respostas. `ID` nomeia Membro, `staff` nomeia Responsável e `Note` nomeia Motivo. `kick`, `staff` e `Note` podem ficar de fora quando o emoji personalizado não está disponível; a frase continua com `sucess` e o campo Membro continua com `ID`. O nome e o motivo aparecem em código, para o texto informado não virar formatação. Sem motivo, o campo diz "Nenhum motivo informado." A confirmação vai ao canal. O erro e a recusa ficam na resposta do comando.

Na consulta de emoji, a resposta é só o embed. `ID` nomeia Identidade e `photo` nomeia Menção. A imagem fica à direita, e o botão **Abrir no navegador** aponta para ela.

Negação de permissão permanece quase igual de propósito: o tom não suaviza nem provoca quando o acesso é recusado.

## Fora deste escopo

Logs de terminal em `apps/bot/src/infrastructure/logging/terminalFormatter.ts` e as demais mensagens estritamente operacionais continuam neutros, conforme os [logs humanos do bot](../decisions/human-readable-bot-logs.md). A descrição de slash command (`setDescription`) também fica neutra e curta: a personalidade vale para a resposta, não para o catálogo de comandos. `acknowledge()` só aciona o indicador nativo de carregamento do Discord.

## Estado

Documentado em 1º de outubro de 2026. As regras de personalidade das falas e de emojis nas falas são obrigatórias. As respostas visíveis dos comandos já seguem este tom. Descrições de comando, logs, mensagens operacionais e o indicador nativo de carregamento continuam fora deste escopo.
