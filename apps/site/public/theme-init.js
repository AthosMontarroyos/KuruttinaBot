// Aplica o tema escolhido antes da primeira pintura, para a página não piscar no tema errado. Sem escolha salva, vale o do sistema (prefers-color-scheme no CSS). A chave é a mesma de src/lib/theme.ts.
try {
  var stored = localStorage.getItem('kuruttina-theme');
  if (stored === 'light' || stored === 'dark') document.documentElement.setAttribute('data-theme', stored);
} catch (error) {
  /* Armazenamento indisponível: vale o tema do sistema. */
}
