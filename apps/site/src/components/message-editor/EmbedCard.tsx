'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { activeFormats, applyFormat, parseInline, type Format, type InlineNode } from './markdown-format';
import { LIMITS, hasText, takeKey, type EditorEmbed, type EditorField } from './message-model';
import { usePreviewImage, usePreviewText } from './preview-values';

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#00a8fc] hover:underline" onClick={(event) => event.stopPropagation()}>
      {children}
    </a>
  );
}

function renderNodes(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return node.text;
      case 'code':
        return <code key={index} className="rounded bg-[#1e1f22] px-1 font-mono text-[0.85em]">{node.text}</code>;
      case 'link':
        return <Link key={index} href={node.href}>{node.label}</Link>;
      case 'format': {
        const children = renderNodes(node.children);
        if (node.kind === 'bold') return <strong key={index}>{children}</strong>;
        if (node.kind === 'italic') return <em key={index}>{children}</em>;
        if (node.kind === 'underline') return <u key={index}>{children}</u>;
        if (node.kind === 'strike') return <s key={index}>{children}</s>;
        return <span key={index} className="rounded bg-[#1e1f22] text-transparent hover:bg-white/10 hover:text-inherit" title="Spoiler">{children}</span>;
      }
    }
  });
}

/** Markdown em linha do Discord (código, negrito, itálico, sublinhado, riscado, spoiler e links), sempre como elementos React. */
function renderInline(value: string): ReactNode[] {
  return renderNodes(parseInline(value));
}

const BULLET = /^\s*[-*] (.*)$/u;
const NUMBERED = /^\s*\d+\. (.*)$/u;
const HEADING = /^(#{1,3}) (.+)$/u;
const SUBTEXT = /^-# (.+)$/u;
const headingSizes = ['text-2xl font-bold', 'text-xl font-bold', 'text-lg font-semibold'];

/** Markdown de bloco do Discord: títulos, listas, citações, texto pequeno e blocos de código. */
function renderBlocks(value: string): ReactNode[] {
  const lines = value.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.startsWith('```')) {
      let close = i + 1;
      while (close < lines.length && !(lines[close] ?? '').startsWith('```')) close++;
      if (close < lines.length) {
        nodes.push(<pre key={key++} className="my-1 overflow-x-auto whitespace-pre-wrap rounded border border-[#1e1f22] bg-[#2b2d31] p-2 font-mono text-[0.85em]">{lines.slice(i + 1, close).join('\n')}</pre>);
        i = close + 1;
        continue;
      }
    }
    const subtext = SUBTEXT.exec(line);
    if (subtext) {
      nodes.push(<div key={key++} className="text-xs text-[#949ba4]">{renderInline(subtext[1] ?? '')}</div>);
      i++;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      nodes.push(<div key={key++} className={headingSizes[(heading[1] ?? '#').length - 1]}>{renderInline(heading[2] ?? '')}</div>);
      i++;
      continue;
    }
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: ReactNode[] = [];
      while (i < lines.length && pattern.test(lines[i] ?? '')) {
        items.push(<li key={items.length}>{renderInline(pattern.exec(lines[i] ?? '')?.[1] ?? '')}</li>);
        i++;
      }
      nodes.push(ordered ? <ol key={key++} className="list-decimal pl-6">{items}</ol> : <ul key={key++} className="list-disc pl-6">{items}</ul>);
      continue;
    }
    if (line.startsWith('> ')) {
      const quoted: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('> ')) {
        quoted.push((lines[i] ?? '').slice(2));
        i++;
      }
      nodes.push(<div key={key++} className="border-l-4 border-[#4e5058] pl-3">{quoted.map((quote, quoteIndex) => <div key={quoteIndex} className="whitespace-pre-wrap">{renderInline(quote)}</div>)}</div>);
      continue;
    }
    nodes.push(line === '' ? <div key={key++} className="h-[1.4em]" /> : <div key={key++} className="whitespace-pre-wrap">{renderInline(line)}</div>);
    i++;
  }
  return nodes;
}

const SHORTCUTS: Record<string, Format> = { b: 'bold', i: 'italic', u: 'underline' };

const toolbarButton = 'flex size-8 items-center justify-center rounded text-[#dbdee1] hover:bg-white/10';

function FormatToolbar({ active, onFormat }: { active: Set<Format>; onFormat: (format: Format) => void }) {
  const button = (format: Format, label: string, content: ReactNode) => (
    <button type="button" aria-label={label} title={label} aria-pressed={active.has(format)} className={`${toolbarButton} ${active.has(format) ? 'bg-white/20 text-white' : ''}`} onClick={() => onFormat(format)}>{content}</button>
  );
  return (
    <div role="toolbar" aria-label="Formatação" className="absolute bottom-full left-0 z-20 mb-1 flex items-center gap-0.5 rounded-md bg-[#1e1f22] p-1 shadow-lg" onMouseDown={(event) => event.preventDefault()}>
      {button('bold', 'Negrito', <span className="font-bold">B</span>)}
      {button('italic', 'Itálico', <span className="italic">I</span>)}
      {button('underline', 'Sublinhado', <span className="underline">U</span>)}
      {button('strike', 'Riscado', <span className="line-through">S</span>)}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
      {button('quote', 'Citação', <span className="text-lg font-bold leading-none">“</span>)}
      {button('code', 'Código', <span className="font-mono text-xs">{'</>'}</span>)}
      {button('spoiler', 'Spoiler', (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ))}
    </div>
  );
}

type InlineTextProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  maxLength: number;
  className?: string;
  multiline?: boolean;
  readOnly?: boolean;
  /** Markdown completo (listas, títulos, citação, código) e barra de formatação ao selecionar. */
  rich?: boolean;
};

/** Texto que aparece formatado como no Discord e vira campo de edição ao receber foco. */
export function InlineText({ value, onChange, placeholder, label, maxLength, className = '', multiline = true, readOnly = false, rich = false }: InlineTextProps) {
  const fill = usePreviewText();
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
    const pending = pendingSelection.current;
    if (pending) {
      pendingSelection.current = null;
      field.setSelectionRange(pending.start, pending.end);
      setSelection(pending);
    }
  }, [editing, value]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!editing || !field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [editing]);

  const format = (kind: Format) => {
    const field = fieldRef.current;
    if (!field || field.selectionStart === field.selectionEnd) return;
    const result = applyFormat(value, field.selectionStart, field.selectionEnd, kind);
    if (result.text.length > maxLength) return;
    pendingSelection.current = { start: result.start, end: result.end };
    onChange(result.text);
  };

  // Variáveis aparecem com os valores de exemplo; se o texto ficar vazio (ex.: servidor sem banner), mostra a chave.
  const shown = fill(value) || value;
  const content = shown !== '' ? (rich ? renderBlocks(shown) : renderInline(shown)) : null;

  if (readOnly) {
    if (value === '') return null;
    return <div className={`break-words px-1.5 py-0.5 ${rich ? '' : 'whitespace-pre-wrap'} ${className}`}>{content}</div>;
  }

  if (editing) {
    return (
      <div className="relative">
        {rich && selection.end > selection.start ? <FormatToolbar active={activeFormats(value, selection.start, selection.end)} onFormat={format} /> : null}
        <textarea
          ref={fieldRef}
          aria-label={label}
          rows={1}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          className={`block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded bg-[#1e1f22] px-1.5 py-0.5 text-inherit outline outline-1 outline-[#5865f2] placeholder:text-[#80848e] ${className}`}
          onChange={(event) => onChange(multiline ? event.target.value : event.target.value.replace(/\n/gu, ' '))}
          onSelect={(event) => setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
          onBlur={() => { setEditing(false); setSelection({ start: 0, end: 0 }); }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || (!multiline && event.key === 'Enter')) {
              event.preventDefault();
              setEditing(false);
              return;
            }
            const shortcut = SHORTCUTS[event.key.toLowerCase()];
            if (rich && shortcut && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              format(shortcut);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      role="textbox"
      tabIndex={0}
      aria-label={label}
      className={`min-h-[1.4em] cursor-text break-words rounded px-1.5 py-0.5 hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2] ${rich ? '' : 'whitespace-pre-wrap'} ${className}`}
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}
    >
      {content ?? <span className="text-[#80848e]">{placeholder}</span>}
    </div>
  );
}

const chipButton = 'rounded px-2 py-0.5 text-xs text-[#b5bac1] hover:bg-white/10 hover:text-white';

function ImageIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

type ImageSlotProps = {
  url: string;
  onChange?: (url: string) => void;
  label: string;
  readOnly?: boolean;
  className?: string;
  imageClassName: string;
  iconClassName?: string;
  align?: 'left' | 'right';
};

/** Imagem do embed: só aceita link; sem link (ou se ele não carregar) mostra o ícone. */
function ImageSlot({ url, onChange = () => undefined, label, readOnly = false, className = '', imageClassName, iconClassName = 'size-5', align = 'left' }: ImageSlotProps) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolve = usePreviewImage();
  const { variable, src } = resolve(url);

  useEffect(() => setFailed(false), [src]);

  // Variável de imagem é um link válido; sem valor (ex.: servidor sem banner) mostra o ícone, sem erro.
  const validLink = variable !== null || /^https:\/\/[^\s/]+/u.test(url);
  const picture = src !== '' && validLink && !failed
    ? <img src={src} alt="" referrerPolicy="no-referrer" className={imageClassName} onError={() => setFailed(true)} />
    : <ImageIcon className={`${iconClassName} ${url === '' || variable !== null ? 'text-[#80848e]' : validLink ? 'text-white' : 'text-red-400'}`} />;

  if (readOnly) return url === '' || (variable !== null && src === '') ? null : <div className={className}>{picture}</div>;

  return (
    <div className={`relative ${className}`}>
      <button type="button" aria-label={label} aria-expanded={open} className="block rounded hover:bg-white/10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#5865f2]" onClick={() => setOpen((current) => !current)}>
        {picture}
      </button>
      {open ? (
        <div className={`absolute top-full z-10 mt-1 flex w-64 flex-col gap-1 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <input
            autoFocus
            type="url"
            aria-label={`Link: ${label}`}
            placeholder="Cole o link da imagem (https://…)"
            className="min-h-8 rounded bg-[#1e1f22] px-2 text-sm text-[#dbdee1] outline outline-1 outline-[#5865f2]"
            value={url}
            onChange={(event) => onChange(event.target.value.trim())}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
          {url !== '' && !validLink ? <p role="alert" className="rounded bg-[#1e1f22] px-2 py-1 text-xs text-red-400">Use o link público da imagem, começando com https://. Links blob: ou de arquivos do computador não funcionam.</p> : null}
          {validLink && failed && variable === null ? <p role="alert" className="rounded bg-[#1e1f22] px-2 py-1 text-xs text-red-400">Não foi possível carregar essa imagem. Confira se o link abre direto a imagem.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

type EmbedCardProps = {
  embed: EditorEmbed;
  index: number;
  onChange?: (embed: EditorEmbed) => void;
  onRemove?: () => void;
  readOnly?: boolean;
};

export function EmbedCard({ embed, index, onChange = () => undefined, onRemove = () => undefined, readOnly = false }: EmbedCardProps) {
  const [ghostKey, setGhostKey] = useState(() => takeKey());
  const patch = (changes: Partial<EditorEmbed>) => onChange({ ...embed, ...changes });

  // O próximo campo aparece como sugestão assim que o último recebe texto; escrever nele o torna real.
  const lastField = embed.fields[embed.fields.length - 1];
  const showGhost = !readOnly && embed.fields.length < LIMITS.embedFields && (lastField === undefined || hasText(lastField));
  const slots: EditorField[] = showGhost ? [...embed.fields, { key: ghostKey, name: '', value: '', inline: false }] : embed.fields;

  const patchField = (key: number, changes: Partial<EditorField>) => {
    if (showGhost && key === ghostKey) {
      patch({ fields: [...embed.fields, { key, name: '', value: '', inline: false, ...changes }] });
      setGhostKey(takeKey());
      return;
    }
    patch({ fields: embed.fields.map((field) => (field.key === key ? { ...field, ...changes } : field)) });
  };

  const hasHeader = embed.authorName !== '' || embed.authorIconUrl !== '';
  const hasFooter = embed.footer !== '' || embed.footerIconUrl !== '';

  return (
    <div className="flex max-w-[520px] flex-col gap-1">
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-1 text-xs text-[#b5bac1]">
          <span className="mr-1">Embed {index + 1}</span>
          {embed.color !== '' ? <button type="button" className={chipButton} onClick={() => patch({ color: '' })}>Remover cor</button> : null}
          <button type="button" className={`${chipButton} ml-auto`} onClick={onRemove}>Remover embed</button>
        </div>
      )}
      <div className="flex rounded bg-[#2b2d31] text-sm">
        <label
          className={`relative w-2 shrink-0 rounded-l ${readOnly ? '' : 'cursor-pointer hover:brightness-125'}`}
          style={{ backgroundColor: embed.color === '' ? '#1e1f22' : embed.color }}
          title={readOnly ? undefined : 'Clique para mudar a cor'}
        >
          {readOnly ? null : (
            <input
              type="color"
              aria-label={`Cor do embed ${index + 1}`}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              value={embed.color === '' ? '#1e1f22' : embed.color}
              onChange={(event) => patch({ color: event.target.value })}
            />
          )}
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            {readOnly && !hasHeader ? null : (
              <div className="flex items-center gap-1">
                <ImageSlot readOnly={readOnly} label="Ícone do autor" url={embed.authorIconUrl} onChange={(authorIconUrl) => patch({ authorIconUrl })} imageClassName="size-6 rounded-full object-cover" iconClassName="size-4" className="shrink-0" />
                <InlineText readOnly={readOnly} className="text-xs font-semibold text-white" label={`Autor do embed ${index + 1}`} placeholder="Nome do autor" maxLength={LIMITS.authorName} multiline={false} value={embed.authorName} onChange={(authorName) => patch({ authorName })} />
              </div>
            )}
            <InlineText readOnly={readOnly} className="mt-1 text-base font-semibold text-white" label={`Título do embed ${index + 1}`} placeholder="Título" maxLength={LIMITS.embedTitle} multiline={false} value={embed.title} onChange={(title) => patch({ title })} />
            <InlineText rich readOnly={readOnly} className="mt-1" label={`Descrição do embed ${index + 1}`} placeholder="Descrição" maxLength={LIMITS.embedDescription} value={embed.description} onChange={(description) => patch({ description })} />
            {slots.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
                {slots.map((field, fieldIndex) => {
                  const ghost = showGhost && field.key === ghostKey;
                  return (
                    <div key={field.key} className={`group flex min-w-0 flex-col ${field.inline ? 'col-span-1' : 'col-span-3'} ${ghost && fieldIndex > 0 ? 'opacity-60 focus-within:opacity-100' : ''}`}>
                      <InlineText readOnly={readOnly} className="font-semibold text-white" label={`Nome do campo ${fieldIndex + 1}`} placeholder={`Nome do campo ${fieldIndex + 1}`} maxLength={LIMITS.fieldName} multiline={false} value={field.name} onChange={(name) => patchField(field.key, { name })} />
                      <InlineText rich readOnly={readOnly} label={`Valor do campo ${fieldIndex + 1}`} placeholder={`Valor do campo ${fieldIndex + 1}`} maxLength={LIMITS.fieldValue} value={field.value} onChange={(value) => patchField(field.key, { value })} />
                      {readOnly || ghost ? null : (
                        <div className="flex gap-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                          <button type="button" aria-pressed={field.inline} className={`${chipButton} ${field.inline ? 'bg-white/10 text-white' : ''}`} onClick={() => patchField(field.key, { inline: !field.inline })}>Inline</button>
                          <button type="button" className={chipButton} onClick={() => patch({ fields: embed.fields.filter((item) => item.key !== field.key) })}>Remover</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          <ImageSlot readOnly={readOnly} label="Miniatura" url={embed.thumbnailUrl} onChange={(thumbnailUrl) => patch({ thumbnailUrl })} imageClassName="size-20 rounded object-cover" iconClassName="size-6" className="shrink-0" align="right" />
        </div>
        <ImageSlot readOnly={readOnly} label="Imagem" url={embed.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} imageClassName="max-h-72 w-full rounded object-cover" iconClassName="size-6" />
        {readOnly && !hasFooter ? null : (
          <div className="flex items-center gap-1">
            <ImageSlot readOnly={readOnly} label="Ícone do rodapé" url={embed.footerIconUrl} onChange={(footerIconUrl) => patch({ footerIconUrl })} imageClassName="size-5 rounded-full object-cover" iconClassName="size-4" className="shrink-0" />
            <InlineText readOnly={readOnly} className="text-xs text-[#b5bac1]" label={`Rodapé do embed ${index + 1}`} placeholder="Texto do rodapé" maxLength={LIMITS.footerText} multiline={false} value={embed.footer} onChange={(footer) => patch({ footer })} />
          </div>
        )}
        </div>
      </div>
      {readOnly ? null : (
        <details className="text-xs text-[#b5bac1]">
          <summary className="cursor-pointer rounded px-2 py-0.5 hover:bg-white/10">Links</summary>
          <div className="mt-1 flex flex-col gap-1.5 px-2">
            <label className="flex flex-col gap-0.5">
              Link do título
              <input type="url" className="min-h-8 rounded bg-[#1e1f22] px-2 text-sm text-[#dbdee1]" placeholder="https://" value={embed.url} onChange={(event) => patch({ url: event.target.value })} />
            </label>
            <label className="flex flex-col gap-0.5">
              Link do autor
              <input type="url" className="min-h-8 rounded bg-[#1e1f22] px-2 text-sm text-[#dbdee1]" placeholder="https://" value={embed.authorUrl} onChange={(event) => patch({ authorUrl: event.target.value })} />
            </label>
          </div>
        </details>
      )}
    </div>
  );
}
