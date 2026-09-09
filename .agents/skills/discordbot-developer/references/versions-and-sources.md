# Versões, upgrades e fontes

## Regra de frescor

Use docs da versão instalada. Páginas `main` podem descrever código não publicado; o guia v15 não orienta automaticamente projetos v14. Limites por rota, monetização, verificação e rollouts podem mudar.

Antes de implementar ou atualizar:

1. identifique `discord.js`, pacotes `@discordjs/*`, Node e `discord-api-types`;
2. abra a API docs correspondente;
3. leia releases/changelog no intervalo;
4. confira o Developer Changelog;
5. rode typecheck/testes e valide payloads;
6. aplique migração incremental, sem misturar APIs futuras.

Depreciações relevantes na linha v14 recente incluem `ephemeral`/`fetchReply` no reply payload, `default_permission`, `dm_permission`, `Message#interaction`, `sendPremiumRequired()`, aliases antigos de intents e strings de eventos quando o enum `Events` existe.

## Fontes canônicas

- [discord.js releases](https://github.com/discordjs/discord.js/releases)
- [discord.js repository](https://github.com/discordjs/discord.js)
- [discord.js API packages](https://discord.js.org/docs/packages/discord.js/14.27.0)
- [discord.js guide](https://discordjs.guide/)
- [Atualização para v14](https://discordjs.guide/legacy/additional-info/changes-in-v14)
- [Prévia v15](https://discordjs.guide/v15)
- [Discord Developer Documentation](https://docs.discord.com/developers/intro)
- [API Reference](https://docs.discord.com/developers/reference)
- [Developer Changelog](https://docs.discord.com/developers/change-log)

## Proveniência

Esta skill foi inspirada por `discord-bot-architect`, fonte declarada `vibeship-spawner-skills` sob Apache-2.0, e reescrita para remover Pycord/Python, corrigir material desatualizado e organizar a consulta progressiva. Restrições normativas devem ser atribuídas à documentação oficial do Discord.
