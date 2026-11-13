import { themeLabels, useTheme, type ThemePreference } from '../lib/theme';
import { headerIconButton, headerIconButtonFixed, headerIconImage, headerIconImageFixed } from './header-icon';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

const icons: Record<ThemePreference, typeof SunIcon> = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

/**
 * Botão redondo da barra que passa o tema do sistema para claro, escuro e de volta. O ícone mostra o estado atual, não a
 * próxima ação; o nome acessível e o `title` dizem o estado ("Tema: claro"). `fixed` usa tamanho único em vez de crescer com a tela.
 *
 *     <ThemeToggle />
 */
function ThemeToggle({ fixed = false }: { fixed?: boolean }) {
  const { preference, cycle } = useTheme();
  const Icon = icons[preference];
  const label = themeLabels[preference];
  return (
    <button className={fixed ? headerIconButtonFixed : headerIconButton} type="button" aria-label={label} title={label} onClick={cycle}>
      <Icon className={`size-5 ${fixed ? headerIconImageFixed : headerIconImage}`} />
    </button>
  );
}

export { ThemeToggle };
