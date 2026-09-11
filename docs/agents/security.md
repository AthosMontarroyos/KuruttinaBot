# Segurança transversal

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

Para o bot Discord atual, a configuração exige ambos os tokens/IDs, seleciona o alvo apenas por `BOT_TARGET` e valida a identidade ativa em `/users/@me` antes de deploy ou Gateway. Não há fallback entre credenciais; consulte o [ADR de credenciais duplas](../decisions/dual-bot-credentials.md) e o [snapshot do estado atual](../project/current-state.md).

## 8. Segurança transversal

### Regra: entrada não confiável

**Nível:** MUST

**Regra:** Valide em runtime toda entrada de HTTP, OAuth, Discord, banco legado, fila, arquivo e serviço externo. TypeScript não valida runtime. Use `unknown`, schema, narrowing e limites de comprimento/faixa/enum; rejeite campos inesperados em objetos sensíveis.

### Regra: autorização por operação e recurso

**Nível:** MUST

**Regra:** A camada server-side verifica identidade, papel/capacidade, ownership/tenant e ação em toda leitura e mutation protegida. A query também deve restringir pelo tenant/recurso em vez de buscar globalmente e filtrar depois.

### Regra: secrets

**Nível:** MUST

**Regra:** Nunca versione, exponha ao bundle client, retorne, mostre em screenshot ou registre tokens, senhas, cookies, strings de conexão, client secrets ou webhook URLs. Rotacione imediatamente segredo suspeito de exposição e remova-o do histórico conforme procedimento aprovado.

### Regra: XSS e conteúdo ativo

**Nível:** MUST

**Regra:** Renderize texto com escaping padrão. Não use `dangerouslySetInnerHTML` nem aceite HTML/Markdown ativo sem sanitizador bem mantido e policy explícita. Aplique CSP compatível e evite scripts inline quando possível.

### Regra: SSRF e chamadas externas

**Nível:** MUST

**Regra:** URL fornecida pelo usuário não é buscada livremente pelo servidor. Faça parse/normalização estritos, rejeite credenciais embutidas e aplique allowlist de protocolo, host e porta. Em cada conexão e redirect, resolva todos os endereços A/AAAA, normalize IPv4, IPv6 e IPv4-mapped IPv6 e rejeite o destino se qualquer endereço cair em loopback, privado/unique-local, link-local, multicast, não especificado, reservado ou metadata. Revalide cada hop e limite redirects; fixe a conexão a um IP já validado (preservando Host/SNI) ou use cliente/proxy que impeça nova resolução para evitar DNS rebinding/TOCTOU. Defina timeout, limite de bytes e concorrência e, quando disponível, confirme que o peer conectado continua permitido.

### Regra: uploads

**Nível:** MUST

**Regra:** Só implemente upload com necessidade explícita. Limite tamanho, quantidade e tipo por assinatura real; gere nome próprio, armazene fora da árvore executável e sirva como conteúdo não executável. Não confie em extensão ou `Content-Type` informado.

### Regra: rate limit e abuso

**Nível:** SHOULD

**Regra:** Endpoints de autenticação, mutations, busca cara e ações administrativas usam limite por identidade e origem, com teto e janela documentados. Um limiter local deve ter tamanho/TTL e serve apenas a instância única/baixo risco; proteção distribuída é necessária quando múltiplas instâncias ou alto impacto justificarem.

### Regra: dependências de segurança

**Nível:** MUST

**Regra:** Não reimplemente criptografia, OAuth, sessão ou sanitização crítica para economizar dependência. Use biblioteca mantida, fixe versões pelo lockfile, revise advisories e atualize com testes. Scripts de instalação de nova dependência também entram na revisão.

### Regra: least privilege operacional

**Nível:** MUST

**Regra:** Restrinja permissões Discord, scopes OAuth, roles PostgreSQL/Supabase, acesso Square Cloud, rede, filesystem e tokens ao mínimo necessário. Development e production usam projetos Supabase e credenciais completamente distintos. Credenciais do painel/Management API, owner/migration e secret/`service_role` não entram no runtime comum nem no bundle client.

### Regra: fronteira Supabase

**Nível:** MUST

**Regra:** Trate o projeto Supabase como sistema externo privilegiado. Permita acesso administrativo somente a contas individuais necessárias, com MFA, sem compartilhamento de login. A aplicação recebe apenas secrets do ambiente e função correspondentes. Nunca registre URL com senha, headers de autorização, JWT, chaves ou payloads sensíveis; alertas e screenshots também devem ser redigidos. Rotacione imediatamente qualquer credencial suspeita e atualize apenas o ambiente afetado.

### Regra: resposta a erro

**Nível:** MUST

**Regra:** Falhe fechado em autenticação/autorização/configuração inválida. Não inclua stack, SQL, caminho interno, token ou dados pessoais em resposta pública. Atribua correlation ID seguro para diagnóstico.
