# Personalidade do bot

A voz das respostas ao usuário toma Kurumi Tokisaki, de Date A Live, como referência de temperamento. Não é roleplay: o bot não cita a série, não usa bordões e não se apresenta como a personagem.

Consulte este documento ao escrever ou revisar texto de resposta. As mensagens atuais ainda não seguem este tom; a migração é tarefa futura. O que o código envia hoje está no [estado implementado](current-state.md).

## Traços

- Educada e elegante. Trata quem chamou com cortesia, sem formalidade rígida.
- Confiante. Diz o que fez ou o que falta, sem pedir desculpas em excesso.
- Charme discreto. A frase pode soar próxima quando o pedido já está claro.
- Ironia leve. Só quando não esconde a informação nem diminui quem pediu ajuda.
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

## Guia por situação

Os exemplos da coluna "No tom" são ilustrativos e não estão implementados. A coluna "Atual" cita o texto que o código envia hoje.

| Situação | Atual | No tom (não implementado) |
| --- | --- | --- |
| Sucesso | Emoji **nome** adicionado a este servidor. | Pronto. O emoji **nome** agora está neste servidor. |
| Erro | Não consegui buscar as mensagens. Tente novamente daqui a pouco! | Não consegui buscar as mensagens. Tente de novo daqui a pouco. |
| Permissão negada | Você precisa da permissão **Gerenciar mensagens** neste canal. | Você precisa da permissão **Gerenciar mensagens** neste canal. |
| Entrada inválida | Quantas mensagens vamos apagar? Escolha um número de **1 a 200**! | Diga quantas mensagens apagar: um número de **1 a 200**. |
| Bot ocupado | Estou ocupado agora. Tente novamente em instantes. | Já estou ocupada. Tente de novo em instantes. |
| Ping | Pong! | Pong. Ainda estou aqui. |

Negação de permissão permanece quase igual de propósito: o tom não suaviza nem provoca quando o acesso é recusado.

## Emojis

Escolha os nomes no [catálogo de emojis](emoji-catalog.md). O tom não depende de emoji. Se o resolver devolver vazio, a frase continua completa. Não invente nome fora do catálogo.

## Fora deste tom

Logs de terminal em `apps/bot/src/infrastructure/terminalFormatter.ts` e as demais mensagens para a equipe continuam neutros, conforme os [logs humanos do bot](../decisions/human-readable-bot-logs.md). A descrição de slash command (`setDescription`) também fica neutra e curta: a personalidade vale para a resposta, não para o catálogo de comandos.

## Estado

Documentado em 30 de setembro de 2026. Nenhuma mensagem de comando foi reescrita. Aplicar o tom, começando por um comando piloto, é tarefa separada e exige atualizar os testes que comparam o texto exato.
