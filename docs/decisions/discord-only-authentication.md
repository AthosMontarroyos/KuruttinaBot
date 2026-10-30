# Login exclusivo via Discord

Status: aprovado pelo responsável pelo projeto em 15 de outubro de 2026.

O site terá login exclusivamente via Discord. Não haverá cadastro local, login com senha, recuperação de senha nem serviço adicional de autenticação.

## Decisão

- Discord é a única fonte de identidade para login. O fluxo futuro usa OAuth do Discord e obtém o identificador no servidor.
- É proibido implementar métodos alternativos de login e introduzir Supabase Auth ou qualquer outro serviço de autenticação.
- Sessões e validação no servidor continuam necessárias para manter o login via Discord. O identificador retornado pelo Discord não substitui sessão, autorização nem proteção contra CSRF.
- Autenticação pelo Discord não concede privilégios administrativos. Os usuários privilegiados são os registros de `bot_private.bot_staff` do ambiente correspondente, com os papéis existentes `creator` e `dev`. Essa tabela não cadastra todos os visitantes e não será substituída por outro cadastro de administradores nem por um identificador fixo de configuração.
- O login não autoriza provisionamento de usuários nem concessão de privilégios. Agentes não criam contas, usuários de teste ou registros privilegiados sem autorização explícita do responsável.

Autenticação via OAuth do Discord e o painel por servidor estão implementados. O procedimento obrigatório continua na [skill do website](../../.claude/skills/website-developer/SKILL.md).

## Limites

A integração futura deverá respeitar o acesso por `packages/database` e a RLS existente. Esta decisão não presume que o acesso atual do bot já atende ao site. O contrato da tabela foi conferido nos arquivos versionados; os registros remotos não foram consultados.
