# KuruttinaBot

Bot multifuncional para comunidades Discord, com identidade própria e evolução orientada pelas necessidades de quem participa e administra os servidores. Moderação, gerenciamento de emojis e controle de acesso da equipe fazem parte das funcionalidades atuais, sem limitar o propósito do produto.

Projeto proprietário de Athos Montarroyos, apresentado como parte de seu portfólio de desenvolvimento de software.

## Funcionalidades implementadas

- Comandos de aplicação e por prefixo, com as mesmas políticas de autorização.
- Limpeza de mensagens com verificação de permissões.
- Consulta de emojis personalizados, com origem, marcação copiável e imagem.
- Importação de emojis para servidores e para a aplicação de produção, com processamento de imagens estáticas e animadas.
- Acesso restrito a ferramentas da equipe, com validação de identidade, papel e servidor.

## Engenharia

Desenvolvido em TypeScript sobre Node.js e discord.js, com persistência PostgreSQL. A arquitetura separa comandos, regras de aplicação e integrações externas, com configuração validada e acesso a dados em módulos próprios.

O projeto inclui testes automatizados de comportamento, autorização e isolamento no banco de dados, além de verificações de tipos, build e detecção de segredos no CI.

## Estado do projeto

Em desenvolvimento ativo. O bot e sua camada de persistência estão implementados. A primeira Home responsiva baseada no Figma está disponível para execução local; o painel administrativo e suas integrações continuam previstos para uma etapa futura.

O projeto está em replanejamento de identidade visual e stack tecnológica. A direção aprovada, o inventário de mudanças e as decisões pendentes estão no [replanejamento do projeto](docs/project/replanning.md). A nova paleta e a arquitetura futura ainda serão definidas.

## Autoria e licença

© 2026 Athos Montarroyos. Todos os direitos reservados.

Código proprietário disponibilizado para apresentação de portfólio. Os termos aplicáveis estão em [LICENSE.md](LICENSE.md).
