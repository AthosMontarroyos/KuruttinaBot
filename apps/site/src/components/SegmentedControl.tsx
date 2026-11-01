type SegmentedControlProps<T extends string> = {
  /** Nome do grupo para tecnologia assistiva ("Evento"). */
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
};

/** Escolha de uma opção entre poucas (abas de um mesmo formulário), em botões lado a lado dentro de uma pílula. */
function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex gap-1 self-start rounded-[12px] border border-border bg-surface p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-[8px] border-0 px-5 text-sm font-semibold transition-colors motion-reduce:transition-none ${value === option.value ? 'bg-accent-soft text-accent-fg' : 'bg-transparent text-muted hover:text-text'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export { SegmentedControl };
