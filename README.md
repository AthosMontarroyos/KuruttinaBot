<p align="center">
  <strong>KuruttinaBot</strong><br>
  Bot multifuncional para Discord, com painel web.
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licença AGPL-3.0" src="https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0-blue"></a>
  <a href="https://github.com/AthosMontarroyos/KuruttinaBot/actions/workflows/quality.yml"><img alt="Quality" src="https://github.com/AthosMontarroyos/KuruttinaBot/actions/workflows/quality.yml/badge.svg"></a>
  <a href="https://github.com/AthosMontarroyos/KuruttinaBot/actions/workflows/gitleaks.yml"><img alt="Gitleaks" src="https://github.com/AthosMontarroyos/KuruttinaBot/actions/workflows/gitleaks.yml/badge.svg"></a>
</p>

**Em operação · desenvolvimento ativo**

## O que é

Bot para comunidades Discord, com painel web para quem administra o servidor. A instância em operação é o produto. O código está em desenvolvimento ativo.

## Funcionalidades

No bot:

- Moderação: expulsar, banir, desbanir, castigar, remover castigo e limpar mensagens, com permissão e hierarquia de cargos.
- Emojis personalizados: consulta e importação para o servidor. A importação para a aplicação de produção passa pelo comando de equipe e por um workflow.
- Ajuda em `/help` e `k!help`, e a página de comandos do site, as duas geradas a partir dos próprios comandos.

No painel:

- Templates de mensagem com botões e menus.
- Ações desses botões e menus.
- Grupos de cargos.
- Mensagens de entrada e saída de membros.

O acesso ao painel é login pelo Discord.

## Como usar

O prefixo é `k!`. `K!` também vale. A ajuda é `/help` ou `k!help`.

O convite público está em breve.

## Stack

TypeScript e Node.js. O CI, as imagens e a VPS usam Node 24; o pacote também declara Node 22.14+ e 26. O bot usa discord.js 14.27. O site usa React 19, Vite e Tailwind CSS 4, com servidor HTTP em Node. A persistência é PostgreSQL, acessado no servidor pelo driver `pg`; o Supabase entra como Postgres, sem SDK no runtime.

O monorepo tem `apps/bot`, `apps/site` e os pacotes `config`, `database`, `message-templates` e `command-catalog`.

## Arquitetura

Comandos, regras e integrações ficam separados. O estado implementado, o mapa dos arquivos e o contrato da Home estão em [docs/project](docs/project/current-state.md). As decisões aprovadas estão em [docs/decisions](docs/decisions/).

Pontos de entrada: [estado atual](docs/project/current-state.md), [organização do bot](docs/project/bot-file-organization.md), [Home e painel](docs/project/site.md) e [licença AGPL-3.0](docs/decisions/agpl-3.0.md).

## Instância própria

A AGPL-3.0 permite estudar, modificar e executar o programa, inclusive numa instância própria. Este repositório não dá suporte a essa instalação. O produto para as comunidades é a instância oficial, operada por Athos Montarroyos. Fork muda o nome e os visuais, conforme [TRADEMARK.md](TRADEMARK.md).

## Licença e marca

O código está sob a [GNU AGPL-3.0](LICENSE). Essa licença passa a valer a partir do commit que adiciona `LICENSE` e [NOTICE](NOTICE), no lugar da licença proprietária anterior. O histórico anterior a esse commit não foi relicenciado.

A marca não faz parte da AGPL. Nomes, logo, avatar, emojis e ilustrações estão em [TRADEMARK.md](TRADEMARK.md).

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Contribuição exige o CLA descrito lá, para que o autor possa relicenciar o projeto ou oferecer licença comercial. O [código de conduta](CODE_OF_CONDUCT.md) é o Contributor Covenant 2.1.

## Segurança

Reporte vulnerabilidade em privado, como descrito em [SECURITY.md](SECURITY.md).

## Apoie

O projeto aceita apoio pelo GitHub Sponsors de [Athos Montarroyos](https://github.com/sponsors/AthosMontarroyos).

## Autoria

Athos Montarroyos, 2026. Autor do código e titular da marca.
