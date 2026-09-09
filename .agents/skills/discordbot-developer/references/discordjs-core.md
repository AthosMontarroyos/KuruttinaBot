# Núcleo do discord.js

## Compatibilidade primeiro

- Leia `package.json`, lockfile e `node_modules/discord.js/package.json` quando disponível.
- Em 2026-09-07, a linha estável pesquisada era `discord.js` 14.27.0; v15 era alvo futuro. Isso não substitui a inspeção local.
- A tag 14.27.0 declara Node `>=18`, mas a página de docs rotulada 14.27.0 pode mostrar requisitos mais novos. Para manutenção, o `engines` do pacote instalado é a evidência local; para projeto novo, escolha um Node LTS suportado pelos pacotes efetivamente instalados.
- ESM e CommonJS são suportados na linha v14, mas não misture os estilos. Preserve o padrão do projeto.

## Arquitetura

Use `Client` como hub do Gateway, managers/structures para recursos e cache, `REST`/`Routes` para HTTP, e builders para payloads serializáveis. Um layout comum separa bootstrap/configuração do Client, loaders, commands, events, router de interactions, deployment e serviços de negócio.

Não force esse layout sobre um projeto com arquitetura coerente diferente. Use `Collection` quando o lookup agrega valor e type guards antes de acessar APIs específicas da interaction.

## Intents

`ClientOptions.intents` é obrigatório. Intents controlam eventos e dados recebidos; permissões controlam ações.

- `Guilds` sustenta muitos caches e eventos estruturais.
- `GuildMembers`, `GuildPresences` e `MessageContent` são privilegiados.
- DMs e reactions podem exigir intents e partials correspondentes.
- Sem um intent, um evento pode não chegar ou uma structure pode conter apenas IDs.
- Evite `MessageContent`: prefira application commands e components.

## Partials e cache

Para structure potencialmente parcial: verifique `.partial`, tente `.fetch()` quando permitido, trate falhas e não suponha que dado deletado pode ser recuperado. Um partial só garante `id`. Um item ausente de `.cache` pode existir; use `fetch()` quando a correção depender do estado atual.

Customize cache com `Options.cacheWithLimits`, `makeCache` e `sweepers` somente após medir. Não substitua caches de `GuildManager`, `ChannelManager`, `GuildChannelManager`, `RoleManager` ou `PermissionOverwriteManager`.

## Builders e tipos

Prefira builders compatíveis com a versão instalada. `toJSON()` é o limite natural para REST, snapshots e testes de contrato. Não desabilite validação sem razão verificada.

Em TypeScript, use `import type`, type guards e `Client<true>` após ready; evite `any`, structures instanciadas manualmente e APIs internas. Modele ports estreitos para serviços externos.

## Testes

- Teste regras puras fora do Discord.
- Teste builders via `toJSON()`.
- Use doubles dos seus ports, não structures completas.
- Rode typecheck, lint e testes em CI.
- Use integração real somente com app/guild de desenvolvimento e credenciais externas ao repositório.

## Fontes

- [API discord.js](https://discord.js.org/docs/packages/discord.js/14.27.0)
- [Command handling](https://discordjs.guide/legacy/app-creation/handling-commands)
- [Event handling](https://discordjs.guide/legacy/app-creation/handling-events)
- [Gateway intents](https://discordjs.guide/legacy/popular-topics/intents)
- [Partials](https://discordjs.guide/legacy/popular-topics/partials)
- [Cache customization](https://discordjs.guide/legacy/miscellaneous/cache-customization)
