import { useId } from 'react';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** `id` do elemento que dá o nome ao interruptor; use quando o texto fica fora de `SwitchField`. */
  labelledBy: string;
};

/** Interruptor liga/desliga. Prefira `SwitchField`, que já traz o texto; este serve quando o rótulo tem layout próprio. */
function Switch({ checked, onChange, disabled = false, labelledBy }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${checked ? 'border-button bg-button' : 'border-control bg-transparent'}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-4 rounded-full transition-transform motion-reduce:transition-none ${checked ? 'translate-x-[23px] bg-button-text' : 'translate-x-0.5 bg-text'}`}
      />
    </button>
  );
}

type SwitchFieldProps = {
  label: string;
  /** Frase curta embaixo do rótulo explicando o que o interruptor faz. */
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Desenha a linha numa caixa com borda, para destacar a opção dentro de um formulário. */
  boxed?: boolean;
};

/**
 * Linha com o texto à esquerda e o interruptor à direita. Em todo painel, opção de ligar ou desligar usa este
 * componente, nunca um `<input type="checkbox">` solto.
 *
 *     <SwitchField label="Ignorar bots" checked={ignoreBots} onChange={setIgnoreBots} />
 */
function SwitchField({ label, description, checked, onChange, disabled = false, boxed = false }: SwitchFieldProps) {
  const labelId = useId();
  return (
    <div className={`flex items-center justify-between gap-4 ${boxed ? 'rounded-[12px] border border-border px-4 py-3' : ''}`}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-sm font-medium">{label}</span>
        {description ? <span className="text-[13px] leading-5 text-muted">{description}</span> : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} labelledBy={labelId} />
    </div>
  );
}

export { Switch, SwitchField };
