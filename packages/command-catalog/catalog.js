// Gerado por `npm run commands:catalog`. Não edite à mão.
/** @type {readonly import('./index.js').CatalogCommand[]} */
export const COMMAND_CATALOG = [
  {
    "id": "ban",
    "topic": "mod",
    "slash": "/ban",
    "prefix": "k!ban",
    "description": "Bane um usuário do servidor",
    "examples": [
      {
        "slash": "/ban membro:@Fulano motivo:Spam",
        "prefix": "k!ban @Fulano Spam"
      },
      {
        "slash": "/ban membro:123456789012345678",
        "prefix": "k!ban 123456789012345678"
      }
    ],
    "permissions": [
      "Banir membros"
    ]
  },
  {
    "id": "clear",
    "topic": "mod",
    "slash": "/clear",
    "prefix": "k!clear",
    "description": "Limpa mensagens de um canal",
    "examples": [
      {
        "slash": "/clear quantidade:50",
        "prefix": "k!clear 50"
      },
      {
        "slash": "/clear quantidade:20 usuario:@Fulano",
        "prefix": "k!clear 20 @Fulano"
      }
    ],
    "permissions": [
      "Gerenciar mensagens"
    ]
  },
  {
    "id": "emoji-add",
    "topic": "mod",
    "slash": "/emoji add",
    "prefix": "k!emoji-add",
    "description": "Adiciona um emoji a este servidor, a partir de uma imagem ou de um emoji de outro servidor",
    "examples": [
      {
        "slash": "/emoji add emoji:<:nome:123456789012345678>",
        "prefix": "k!emoji-add <:nome:123456789012345678>"
      },
      {
        "slash": "/emoji add nome:meu_emoji arquivo:imagem.png",
        "prefix": "k!emoji-add meu_emoji"
      }
    ],
    "permissions": [
      "Gerenciar emojis"
    ]
  },
  {
    "id": "emoji-info",
    "topic": "mod",
    "slash": "/emoji info",
    "prefix": "k!emoji-info",
    "description": "Mostra a identidade e a imagem de um emoji personalizado",
    "examples": [
      {
        "slash": "/emoji info emoji:<:nome:123456789012345678>",
        "prefix": "k!emoji-info <:nome:123456789012345678>"
      }
    ],
    "permissions": []
  },
  {
    "id": "kick",
    "topic": "mod",
    "slash": "/kick",
    "prefix": "k!kick",
    "description": "Expulsa um membro do servidor",
    "examples": [
      {
        "slash": "/kick membro:@Fulano motivo:Provocação",
        "prefix": "k!kick @Fulano Provocação"
      },
      {
        "slash": "/kick membro:123456789012345678",
        "prefix": "k!kick 123456789012345678"
      }
    ],
    "permissions": [
      "Expulsar membros"
    ]
  },
  {
    "id": "timeout",
    "topic": "mod",
    "slash": "/timeout",
    "prefix": "k!timeout",
    "description": "Aplica um castigo temporário a um membro",
    "examples": [
      {
        "slash": "/timeout membro:@Fulano duracao:10m motivo:Flood",
        "prefix": "k!timeout @Fulano 10m Flood"
      },
      {
        "slash": "/timeout membro:@Fulano duracao:2h",
        "prefix": "k!timeout @Fulano 2h"
      }
    ],
    "permissions": [
      "Castigar membros"
    ]
  },
  {
    "id": "unban",
    "topic": "mod",
    "slash": "/unban",
    "prefix": "k!unban",
    "description": "Revoga o banimento de um usuário",
    "examples": [
      {
        "slash": "/unban membro:123456789012345678 motivo:Apelo aceito",
        "prefix": "k!unban 123456789012345678 Apelo aceito"
      }
    ],
    "permissions": [
      "Banir membros"
    ]
  },
  {
    "id": "untimeout",
    "topic": "mod",
    "slash": "/untimeout",
    "prefix": "k!untimeout",
    "description": "Remove o castigo de um membro",
    "examples": [
      {
        "slash": "/untimeout membro:@Fulano motivo:Acordo feito",
        "prefix": "k!untimeout @Fulano Acordo feito"
      }
    ],
    "permissions": [
      "Castigar membros"
    ]
  },
  {
    "id": "help",
    "topic": "utility",
    "slash": "/help",
    "prefix": "k!help",
    "description": "Lista os comandos e mostra como usar cada um",
    "examples": [
      {
        "slash": "/help",
        "prefix": "k!help"
      },
      {
        "slash": "/help comando:ban",
        "prefix": "k!help ban"
      }
    ],
    "permissions": []
  },
  {
    "id": "ping",
    "topic": "utility",
    "slash": "/ping",
    "prefix": "k!ping",
    "description": "Mostra a latencia da API e do Gateway",
    "examples": [
      {
        "slash": "/ping",
        "prefix": "k!ping"
      }
    ],
    "permissions": []
  }
];
