import type { ComponentType } from 'react';

type SectionId = 'overview' | 'embeds' | 'member-events' | 'roles';
type SectionIcon = ComponentType<{ className?: string }>;

/** Ícone de uma seção do painel do servidor: grade 24×24, traço 1.8, pontas arredondadas, 20px por padrão. */
function sectionIcon(path: string): SectionIcon {
  function Icon({ className = 'size-5' }: { className?: string }) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={path} />
      </svg>
    );
  }
  return Icon;
}

/** Mapa único seção → ícone, lido pela lateral e pelo seletor do celular. */
const sectionIcons: Record<SectionId, SectionIcon> = {
  overview: sectionIcon('M5 20V10M12 20V4M19 20v-7'),
  embeds: sectionIcon('M4 5h16v11H9l-5 4V5z'),
  'member-events': sectionIcon('M10 4H5v16h5M14 8l4 4-4 4M18 12H9'),
  roles: sectionIcon('M3 12V4h8l10 10-8 8zM7.5 8.5h.01'),
};

export { sectionIcons };
export type { SectionId, SectionIcon };
