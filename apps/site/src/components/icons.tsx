import type { ReactNode } from 'react';

type IconProps = { className?: string };

/** Ferramenta usada nas telas que ainda não têm a função pronta. */
function ConstructionIcon({ className = 'size-14' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
    </svg>
  );
}

function PencilIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function TrashIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

function ArrowRightIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PlusIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Arco que gira enquanto uma ação está em andamento; parado quando o usuário prefere menos movimento. */
function SpinnerIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={`${className} animate-spin motion-reduce:animate-none`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

/** Estado "tema do sistema" do botão de tema. */
function MonitorIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/** Estado "tema claro" do botão de tema. */
function SunIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Estado "tema escuro" do botão de tema. */
function MoonIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** Ícones de traço (24×24, traço 1,8) usados na página de comandos e na roleta do celular. */
function StrokeIcon({ className, strokeWidth = 1.8, children }: IconProps & { strokeWidth?: number; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function GridIcon({ className = 'size-5' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.9}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </StrokeIcon>
  );
}

function SlidersIcon({ className = 'size-5' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.9}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M8 14v6" />
    </StrokeIcon>
  );
}

function ShieldIcon({ className = 'size-5' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.9}>
      <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
    </StrokeIcon>
  );
}

function SparkleIcon({ className = 'size-5' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.9}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />
    </StrokeIcon>
  );
}

function GlobeIcon({ className = 'size-5' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.9}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </StrokeIcon>
  );
}

function CheckIcon({ className = 'size-[18px]' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={2.4}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </StrokeIcon>
  );
}

function ChevronDownIcon({ className = 'size-[18px]' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={2.2}>
      <path d="M6 9l6 6 6-6" />
    </StrokeIcon>
  );
}

function SearchIcon({ className = 'size-5' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={1.9}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </StrokeIcon>
  );
}

function CloseIcon({ className = 'size-6' }: IconProps) {
  return (
    <StrokeIcon className={className} strokeWidth={2.2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </StrokeIcon>
  );
}

function TerminalIcon({ className = 'size-6' }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4 6h16v12H4zM8 10l2.5 2L8 14M12.5 14H16" />
    </StrokeIcon>
  );
}

function FileTextIcon({ className = 'size-6' }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" />
    </StrokeIcon>
  );
}

function UserIcon({ className = 'size-6' }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </StrokeIcon>
  );
}

function PanelIcon({ className = 'size-6' }: IconProps) {
  return (
    <StrokeIcon className={className}>
      <path d="M4 5h16v14H4zM10 5v14M13 9h4M13 13h4" />
    </StrokeIcon>
  );
}

export {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  ConstructionIcon,
  FileTextIcon,
  GlobeIcon,
  GridIcon,
  MonitorIcon,
  MoonIcon,
  PanelIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  SlidersIcon,
  SparkleIcon,
  SpinnerIcon,
  SunIcon,
  TerminalIcon,
  TrashIcon,
  UserIcon,
};
