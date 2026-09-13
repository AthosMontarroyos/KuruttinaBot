# Emojis

Use `emojis.example.json` como modelo e copie-o para `emojis.local.json` no desenvolvimento local. Cada vault usa `token`, `nome` e `descricao` opcional. O campo legado `categoria` ainda e aceito, mas ignorado: `npm run emojis:sync` descobre automaticamente o Team de cada app no Discord e salva os emojis no R2 em `emojis/<team>/<app>/`, junto da galeria `index.html` e do inventario `manifest.json`.

O script verifica o acesso ao bucket diretamente pelo perfil local `kurrutina-r2`. A aplicacao production definida no `.env` e a fonte canonica: seus emojis sao espelhados na aplicacao development por ID de origem, nome, animacao e conteudo. Se um emoji de production for apagado e recriado, a mudanca do ID de origem obriga a substituicao correspondente em development mesmo que nome e imagem sejam iguais. Emojis realmente inalterados preservam seus IDs; ausentes ou alterados sao criados novamente e extras sao removidos de development. O manifesto registra o vinculo `sourceEmojiId` e os IDs das duas aplicacoes, mas os WebP sao salvos somente em `Kurummi/Kuruttina/`; development referencia os mesmos caminhos e nunca cria `Kurummi/Kuruttina Dev/`. Os vaults locais continuam sendo consultados e armazenados normalmente.

As duas identidades sao validadas antes do espelhamento e tokens nunca aparecem em logs ou artefatos. Os downloads usam uma pasta temporaria, removida automaticamente depois do envio ao R2. Somente depois de todas as etapas terminarem com sucesso, `emojis/` no R2 e sincronizado como espelho exato: arquivos descartados ou ausentes da origem atual sao removidos. Tokens nunca devem ser reais em exemplos, commits, logs ou capturas de tela; em producao, use fonte server-side e secret store.

`npm run emojis:sync` verifica primeiro se o bucket R2 inteiro esta montado e, quando necessario, monta automaticamente `kurrutina-bot-pictures` como a pasta virtual `R2/` na raiz do projeto. Depois sincroniza os emojis em `R2/emojis/<team>/<app>/`. O mount nao e uma copia permanente: alteracoes feitas nele sao enviadas ao R2 pelo rclone. Use `npm run r2:mount` para montar manualmente e `npm run r2:unmount` para encerrar.

## Uso por agentes em embeds

Antes de desenhar uma mensagem ou embed, o agente deve:

1. Executar `npm run emojis:sync` para atualizar IDs, ownership e arquivos visuais.
2. Ler `R2/emojis/manifest.json`, localizar candidatos pela aplicacao proprietaria e pelo significado pretendido.
3. Abrir o `relativePath` do candidato para inspecionar sua aparencia. `index.html` pode ser usado como visao geral.
4. Confirmar que `applicationId` e o app que enviara a mensagem antes de usar o emoji inline.
5. Para emoji estatico, gerar `<:name:id>`; para animado, gerar `<a:name:id>` usando `animated` do manifesto.

O nome sozinho nunca e suficiente: um emoji recriado recebe ID novo, e todo ID antigo deve ser considerado invalido apos a sincronizacao. Emojis de aplicacao pertencem ao app proprietario; uma vault diferente nao transforma seu emoji em emoji inline compartilhado. Para `thumbnail`, `image`, author icon ou footer icon de um embed, use uma URL HTTPS publica do arquivo, nunca a marcacao inline. O texto deve continuar compreensivel sem o emoji, e a composicao deve preferir poucos emojis semanticamente claros a decoracao excessiva.

### Roteamento por categoria

- `Interactions/` e exclusivo dos comandos de Roleplay. Cada aplicacao interna representa sua acao (`Kiss`, `Lick`, `Dance`, `Hug`, `Pat`, `Punch` ou `Slap`) e deve ser consultada apenas pelo comando correspondente.
- `Kurummi/Kuruttina/` e a fonte obrigatoria dos emojis inline, icones de interface e decoracao geral usados pela Kuruttina principal.
- O manifesto possui IDs proprios para Kuruttina e Kuruttina Dev, enquanto ambas apontam para os assets unicos em `Kurummi/Kuruttina/`.
- Um comando de Roleplay pode usar a midia visual de `Interactions/<acao>/`, mas qualquer emoji inline no texto ou embed deve vir de `Kurummi/Kuruttina/` e respeitar o `applicationId` do manifesto.
