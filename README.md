# KuruttinaBot

Bot para Discord voltado à administração de comunidades, com recursos de moderação, gerenciamento de emojis e controle de acesso da equipe.

Projeto proprietário de Athos Montarroyos, apresentado como parte de seu portfólio de desenvolvimento de software.

## Funcionalidades

- Comandos de aplicação e por prefixo, com as mesmas políticas de autorização.
- Limpeza de mensagens com verificação de permissões.
- Importação de emojis para servidores e para a aplicação de produção, com processamento de imagens estáticas e animadas.
- Acesso restrito a ferramentas da equipe, com validação de identidade, papel e servidor.

## Engenharia

Desenvolvido em TypeScript sobre Node.js e discord.js, com persistência PostgreSQL. A arquitetura separa comandos, regras de aplicação e integrações externas, com configuração validada e acesso a dados em módulos próprios.

O projeto inclui testes automatizados de comportamento, autorização e isolamento no banco de dados, além de verificações de tipos, build e detecção de segredos no CI.

## Estado do projeto

Em desenvolvimento ativo. O bot e sua camada de persistência estão implementados; o painel web está previsto para uma etapa futura.

## Autoria e licença

© 2026 Athos Montarroyos. Todos os direitos reservados.

Código proprietário disponibilizado para apresentação de portfólio. Os termos aplicáveis estão em [LICENSE.md](LICENSE.md).
