# Roleplay: guia operacional para IAs

Use este documento quando a tarefa envolver comandos de ação com GIFs/imagens, seleção por gênero, inclusão de novos assets ou a vault de emojis de Roleplay.

## Regra de escopo

“Roleplay” é o domínio dos assets de ações como `kiss`, `hug`, `dance`, `slap`, `punch` e `lick`.

Não confunda com o recurso nativo de Discord chamado Interaction:

- `apps/bot/src/events/guild/interactions/` continua sendo o dispatcher de slash commands.
- Tipos como `Interaction`, `AutocompleteInteraction` e `ChatInputCommandInteraction` continuam com o nome original da API.
- Para assets, nunca use o caminho antigo `Pictures/interactions`, o módulo antigo `utils/interactions` ou os símbolos antigos `resolveInteractionAsset`.

## Mapa canônico

| Responsabilidade | Local |
|---|---|
| Assets | `Pictures/Roleplay/<ação>/` |
| Resolvedor | `apps/bot/src/utils/Roleplay/roleplay-resolver.ts` |
| Import recomendado | `import { resolveRoleplayAsset } from '../../../utils';` |
| Export barrel | `apps/bot/src/utils/index.ts` |
| Configuração da vault | `config/emoji-vaults.example.json` |
| Categoria da vault | `roleplay` |

O caminho relativo do import varia conforme a profundidade do comando. Sempre prefira o barrel `src/utils/index.ts` em vez de importar o arquivo interno diretamente.

## Contrato da API

A API pública do módulo é:

```ts
type UserGender = 'male' | 'female' | null | undefined;

interface RoleplayResolutionOptions {
  action: string;
  initiatorGender?: UserGender;
  targetGender?: UserGender;
  basePicturesDir?: string;
  ignoreGender?: boolean;
}

interface ResolvedRoleplayAsset {
  absolutePath: string;
  relativePath: string;
  category: 'het' | 'yuri' | 'yaoi' | 'general';
  subCategory?: 'female_initiated' | 'male_initiated' | 'mutual';
  fileName: string;
}

function resolveRoleplayAsset(
  options: RoleplayResolutionOptions
): ResolvedRoleplayAsset | null;
```

Use `absolutePath` para anexar o arquivo ao Discord. Use `relativePath` apenas para logs, diagnóstico ou metadados. O retorno é `null` quando não existe asset elegível.

O resolvedor aceita extensões `.gif`, `.png`, `.jpg`, `.jpeg` e `.webp`.

## Como a seleção funciona

O resolvedor primeiro procura arquivos diretamente em `Pictures/Roleplay/<ação>/`. Depois, salvo quando `ignoreGender: true`, procura as pastas elegíveis abaixo:

| Iniciador | Alvo | Pastas elegíveis |
|---|---|---|
| indefinido | indefinido | `het/male_initiated`, `het/female_initiated`, `het/mutual`, `yuri`, `yaoi` |
| male | female | `het/male_initiated`, `het/mutual` |
| female | male | `het/female_initiated`, `het/mutual` |
| female | female | `yuri` |
| male | male | `yaoi` |
| male | indefinido | `het/male_initiated`, `het/mutual`, `yaoi` |
| female | indefinido | `het/female_initiated`, `het/mutual`, `yuri` |
| indefinido | male | `het/female_initiated`, `het/mutual`, `yaoi` |
| indefinido | female | `het/male_initiated`, `het/mutual`, `yuri` |

Os valores de gênero são normalizados para minúsculas. Valores ausentes, `null` e `undefined` são tratados como gênero desconhecido.

## Estrutura de assets

```
Pictures/Roleplay/
├── dance/
│   ├── 1.gif
│   └── 2.gif
├── hug/
│   ├── 1.gif
│   ├── het/
│   │   ├── 1.gif
│   │   └── mutual/1.gif
│   ├── yuri/
│   │   └── 1.gif
│   └── yaoi/
│       └── 1.gif
└── kiss/
    ├── het/
    │   ├── female_initiated/
    │   ├── male_initiated/
    │   └── mutual/
    ├── yuri/
    └── yaoi/
```

A ação passada em `action` deve corresponder ao nome da pasta diretamente abaixo de `Pictures/Roleplay`. Para adicionar uma ação, crie a pasta e coloque os arquivos nela; não adicione caminhos hardcoded no comando.

## Receita para um comando de Roleplay

1. Resolva o usuário-alvo com `resolveUser` quando o comando aceitar alvo.
2. Obtenha os gêneros do iniciador e do alvo a partir da fonte de perfil já usada pelo projeto.
3. Chame `resolveRoleplayAsset`; não replique a varredura de diretórios no comando.
4. Se o retorno for `null`, responda com `sendErrorReply` e encerre.
5. Anexe `asset.absolutePath` na resposta.
6. Use `CommandContext`, `getEmojis` e os helpers de resposta existentes conforme as regras gerais da skill.

Exemplo mínimo:

```ts
import { resolveRoleplayAsset, sendErrorReply } from '../../../utils';

const asset = resolveRoleplayAsset({
  action: 'kiss',
  initiatorGender,
  targetGender,
});

if (!asset) {
  await sendErrorReply(ctx, 'Asset indisponível', 'Não há GIF elegível para esta combinação.');
  return;
}

await ctx.reply({
  content: 'Ação executada.',
  files: [{ attachment: asset.absolutePath, name: asset.fileName }],
});
```

O exemplo mostra somente a integração do asset. O comando real ainda deve cumprir as regras de slash + prefix, permissões, contexto e resposta definidas na skill principal.

## Vault de emojis

A entrada de configuração deve usar a categoria `roleplay`:

```json
{
  "name": "KuruttinaRoleplay",
  "category": "roleplay",
  "token": "..."
}
```

A listagem administrativa exibe essa categoria como `Roleplay (GIFs/Ações)`. Operações REST em vaults secundárias devem usar `withAppClient`; nunca criar um cliente Discord persistente no comando.

## Roteamento rápido para outras IAs

- Tarefa sobre escolha de GIF, gênero ou ação: leia este documento e o resolvedor; não leia todos os comandos.
- Tarefa sobre slash command, autocomplete ou dispatcher: leia `events/guild/interactions/`; não altere o módulo Roleplay.
- Tarefa sobre vault de emojis: leia `utils/emojis/multi-app-helper.ts`, este documento e a configuração de exemplo.
- Tarefa sobre novo comando: leia este documento apenas para a parte de assets; siga a skill principal para o restante.
- Tarefa sobre novo asset: altere apenas `Pictures/Roleplay/<ação>/` e valide o build se houver alteração de código.

## Checklist de validação

Após alterar código de Roleplay:

```bash
npm --prefix apps/bot run build
rg -n -i 'Pictures/interactions|utils/interactions|interaction-resolver|resolveInteractionAsset|category.*interactions' apps/bot config Pictures
```

O primeiro comando deve passar. O segundo não deve encontrar referências do domínio antigo. Ocorrências genéricas de `interaction` pertencentes à API do Discord não são problema.
