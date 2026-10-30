'use client';

import { useState } from 'react';
import { ACTION_VARIABLES } from '@kuruttina/message-templates/variables';

/** Lista das variáveis de ação (as mesmas que o bot preenche); clicar copia `{chave}`. */
function TemplateGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (name: string) => {
    // `navigator.clipboard` não existe fora de contexto seguro (HTTP).
    void navigator.clipboard?.writeText(`{${name}}`).then(
      () => {
        setCopied(name);
        window.setTimeout(() => setCopied((current) => (current === name ? null : current)), 1500);
      },
      () => undefined,
    );
  };

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {ACTION_VARIABLES.map((variable) => (
        <li key={variable.name}>
          <button type="button" className="flex w-full flex-wrap items-baseline gap-x-3 rounded-[8px] px-2 py-1.5 text-left hover:bg-border" onClick={() => copy(variable.name)}>
            <code className="font-mono text-[13px]">{`{${variable.name}}`}</code>
            <span className="text-[13px] text-muted">{copied === variable.name ? 'Copiado' : variable.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export { TemplateGuide };
