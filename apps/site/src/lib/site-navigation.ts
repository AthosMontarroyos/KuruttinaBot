/** Links principais do site: a barra do desktop e a roleta do celular leem a mesma lista. */
const navigation = [
  { label: 'Comandos', href: '/comandos' },
  { label: 'Módulos', href: '/modulos' },
  { label: 'Termos de serviço', notice: 'Os termos de serviço estarão disponíveis em breve.' },
  { label: 'Painel de controle', href: '/dashboard' },
] as const;

type NavigationItem = (typeof navigation)[number];

export { navigation };
export type { NavigationItem };
